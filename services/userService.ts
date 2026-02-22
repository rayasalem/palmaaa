
import { db } from './core/storage';
import { User, Role, MerchantProfile, ActionResponse, UserStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * User Service
 * Handles registration via Supabase Auth and public profile syncing.
 */
export const userService = {
  
  async register(user: User, password?: string, extraData?: any): Promise<ActionResponse<{ user: User; token: string }>> {
    try {
      if (!isSupabaseConfigured || !supabase) {
        return { success: false, error: 'Supabase is not configured. Cannot register.' };
      }

      // 1. Register with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: password || 'password', 
        options: {
          data: {
            name: user.name,
            role: user.role
          },
          // Critical for production redirect
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
        }
      });

      // Handle "User already registered" gracefully to allow profile sync
      if (authError) {
        if (!authError.message.includes('already registered')) {
           return { success: false, error: authError.message };
        }
      }

      const userId = authData.user?.id;
      if (!userId) {
        return { success: false, error: 'Registration failed to get user ID.' };
      }

      // 2. Prepare Public User Record (دخول بدون موافقة الأدمن: أي يوزر جديد APPROVED)
      const newUser: User = {
        ...user,
        id: userId,
        emailVerified: true,
        status: 'APPROVED',
        isApproved: true,
        createdAt: Date.now(),
        registration_date: new Date().toISOString(),
        companyName: extraData?.company_name || user.companyName,
        city: extraData?.city || user.city,
        cityId: extraData?.city_id,
        villageId: extraData?.village_id,
      };

      // 3. Upsert into Public Table (public.users)
      const payload: any = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          is_approved: true,
          city: newUser.city,
          company_name: newUser.companyName,
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          approved_at: new Date().toISOString()
      };

      try {
          const { error: dbError } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
          
          if (dbError) {
              // Retry without new columns if schema cache is still stale
              if (dbError.code === 'PGRST204' || dbError.message.includes('email_verified')) {
                  console.warn('DB Schema mismatch. Retrying with legacy payload...');
                  const legacyPayload = { ...payload };
                  delete legacyPayload.email_verified;
                  const { error: retryError } = await supabase.from('users').upsert(legacyPayload, { onConflict: 'id' });
                  if (retryError) throw retryError;
              } else {
                  throw dbError;
              }
          }
      } catch (dbErr: any) {
          console.error('Failed to create/update public profile:', dbErr);
          // Non-blocking error logging
      }

      // 4. Handle Merchant Profile
      if (newUser.role === Role.MERCHANT) {
        try {
            await supabase.from('merchant_profiles').upsert({
                user_id: newUser.id,
                business_name: extraData?.business_name || newUser.companyName,
                phone: newUser.phone,
                city: newUser.city,
                city_id: extraData?.city_id,
                village_id: extraData?.village_id,
                region_id: extraData?.region_id,
                logo_url: newUser.logoUrl
            }, { onConflict: 'user_id' });
        } catch (merchErr) {
            console.error('Failed to create merchant profile:', merchErr);
        }
      }

      // 5. Update Local Cache
      db.addItem('users', newUser);

      // 6. Get session so user can stay logged in without email confirmation
      let token = authData.session?.access_token ?? '';
      if (!token && password) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password
        });
        token = signInData.session?.access_token ?? '';
      }

      // Success: user enters directly (no email verification step)
      return { 
        success: true, 
        requiresVerification: false,
        data: { user: newUser, token } 
      };

    } catch (e: any) {
      console.error("Registration Error:", e);
      return { success: false, error: e.message || 'Registration failed' };
    }
  },

  /**
   * Verify User Email with Code (Supabase OTP)
   */
  async verifyEmail(email: string, code: string): Promise<ActionResponse<{ user: User; token: string }>> {
    try {
      if (!isSupabaseConfigured || !supabase) {
        return { success: false, error: 'Supabase not configured' };
      }

      // 1. Verify OTP with Supabase Auth
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Verification succeeded but user data missing.' };
      }

      // 2. Update Public User Record (if exists)
      const updates = {
        email_verified: true,
        status: 'APPROVED',
        is_approved: true,
        approved_at: new Date().toISOString()
      };

      try {
          await supabase.from('users').update(updates).eq('id', data.user.id);
      } catch (e) {
          console.warn('Failed to update public user verified status', e);
      }

      // 3. Sync Local Cache
      const localUser = db.users.find(u => u.email === email);
      if (localUser) {
        Object.assign(localUser, updates);
        localUser.id = data.user.id; 
        db.updateItem('users', localUser.id, localUser);
      }

      const user = localUser || { ...data.user, ...updates } as unknown as User;

      return { 
        success: true, 
        data: { 
          user: user, 
          token: data.session?.access_token || '' 
        } 
      };

    } catch (e: any) {
      console.error("Verification Error:", e);
      return { success: false, error: e.message };
    }
  },

  async resendVerificationCode(email: string): Promise<ActionResponse<void>> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Config missing' };
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
      }
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateProfile(userId: string, data: Partial<User>) {
    db.updateItem('users', userId, data);
  },

  updateMerchantProfile(userId: string, data: Partial<MerchantProfile>) {
    const profile = db.merchantProfiles.find(p => p.user_id === userId);
    if (profile) {
      db.updateItem('merchantProfiles', profile.id, data);
    }
  },

  getMerchantProfile(userId: string) {
    return db.merchantProfiles.find(p => p.user_id === userId);
  },

  getMerchantName(userId: string) {
    const p = this.getMerchantProfile(userId);
    if (p) return p.business_name;
    const u = db.users.find(x => x.id === userId);
    return u ? (u.companyName || u.name) : 'Unknown';
  },

  async getAll(): Promise<User[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase fetch users error:', error);
        return [];
      }
      return data as unknown as User[];
    }
    return [];
  },

  async updateUserStatus(userId: string, status: UserStatus): Promise<ActionResponse<void>> {
    if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('users')
          .update({ status, is_approved: status === 'APPROVED' })
          .eq('id', userId);
        if (error) return { success: false, error: error.message };
    }
    
    const localUser = db.users.find(u => u.id === userId);
    if (localUser) {
        localUser.status = status;
        localUser.isApproved = status === 'APPROVED';
        db.updateItem('users', userId, localUser);
    }
    return { success: true };
  }
};
