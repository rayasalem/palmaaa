
import React, { useState, useMemo, useEffect } from 'react';
import { User, Role } from '../types';
import { userService } from '../services/userService';
import { t } from '../translations';
import Logo from './Logo';
import { getInternalCities, getInternalVillages } from '../services/flashlineService';
import { useToast } from './ToastProvider';
import { Mail, RefreshCcw } from 'lucide-react';

interface RegisterBrokerProps {
  onRegister: (user: User) => void;
  onBackToLogin: () => void;
}

const RegisterBroker: React.FC<RegisterBrokerProps> = ({ onRegister, onBackToLogin }) => {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const { showToast } = useToast();

  useEffect(() => {
    setLang(document.documentElement.lang === 'en' ? 'en' : 'ar');
  }, []);

  // Step state
  const [step, setStep] = useState<'FORM' | 'VERIFY'>('FORM');
  const [verificationCode, setVerificationCode] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company_name: '',
  });

  // Location State
  const cities = useMemo(() => getInternalCities(), []);
  const [selectedCityId, setSelectedCityId] = useState<number | undefined>(undefined);
  const [selectedVillageId, setSelectedVillageId] = useState<number | undefined>(undefined);
  const [selectedRegionId, setSelectedRegionId] = useState<number | undefined>(undefined);
  const [cityName, setCityName] = useState('');
  
  const availableVillages = useMemo(() => selectedCityId ? getInternalVillages(selectedCityId) : [], [selectedCityId]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = parseInt(e.target.value);
    const city = cities.find(c => c.id === cityId);
    if (city) {
      setSelectedCityId(cityId);
      setSelectedRegionId(city.regionId);
      setCityName(lang === 'en' ? city.nameEn : city.nameAr);
      setSelectedVillageId(undefined); // Reset village
    } else {
      setSelectedCityId(undefined);
      setSelectedRegionId(undefined);
      setSelectedVillageId(undefined);
    }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVillageId(parseInt(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Strict validation
    if (!formData.name || !formData.email || !formData.password || !formData.phone || !selectedCityId || !selectedVillageId) {
      const msg = lang === 'en' ? 'All mandatory fields (*) are required' : 'جميع الحقول الأساسية (*) مطلوبة';
      setError(msg);
      showToast(msg, 'warning');
      setLoading(false);
      return;
    }

    const newUser: User = {
      id: '', // Service generated
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      city: cityName, 
      companyName: formData.company_name,
      role: Role.BROKER,
      status: 'PENDING',
      isApproved: false,
      createdAt: Date.now(),
    };

    const result = await userService.register(newUser, formData.password, {
      city_id: selectedCityId,
      village_id: selectedVillageId,
      region_id: selectedRegionId
    });

    if (result.success) {
      if (result.requiresVerification) {
        setStep('VERIFY');
        showToast(lang === 'en' ? 'Registration successful. Check email for code.' : 'تم التسجيل. تحقق من بريدك الإلكتروني للحصول على الرمز.', 'info');
      } else if (result.data) {
        showToast(t.common.success, 'success');
        onRegister(result.data.user);
      }
    } else {
      const msg = result.error || (lang === 'en' ? 'Registration failed' : 'فشل التسجيل');
      setError(msg);
      showToast(msg, 'error');
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await userService.verifyEmail(formData.email, verificationCode);
    if (result.success && result.data) {
      showToast(lang === 'en' ? 'Account Verified!' : 'تم تأكيد الحساب!', 'success');
      onRegister(result.data.user);
    } else {
      setError(result.error || (lang === 'en' ? 'Verification failed' : 'فشل التحقق'));
      showToast(result.error || 'Failed', 'error');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setLoading(true);
    const result = await userService.resendVerificationCode(formData.email);
    if (result.success) {
      showToast(lang === 'en' ? 'Code sent!' : 'تم إرسال الرمز!', 'success');
    } else {
      showToast(result.error || 'Error', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-12 px-4 bg-slate-50 flex items-center justify-center" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {step === 'FORM' ? (
          <>
            <div className="bg-palma-primary p-10 text-center text-white">
              <div className="flex justify-center mb-6">
                <Logo size="medium" theme="dark" showText={false} />
              </div>
              <h1 className="text-2xl font-black tracking-tight">{t.auth.joinBroker}</h1>
              <p className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-2">{t.auth.brokerVerification}</p>
            </div>

            <form onSubmit={handleSubmit} className={`p-10 space-y-5 ${lang === 'en' ? 'text-left' : 'text-right'}`}>
              {error && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-black rounded-2xl text-center uppercase">{error}</div>}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.name} *</label>
                <input required name="name" className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none" value={formData.name} onChange={handleChange} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.phone} *</label>
                <input required name="phone" className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none" value={formData.phone} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.city} *</label>
                  <select 
                    required 
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none appearance-none"
                    onChange={handleCityChange}
                    value={selectedCityId || ''}
                  >
                    <option value="">{lang === 'en' ? 'Select...' : 'اختر...'}</option>
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{lang === 'en' ? c.nameEn : c.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">{lang === 'en' ? 'Area' : 'المنطقة'} *</label>
                  <select 
                    required 
                    disabled={!selectedCityId}
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none disabled:opacity-50 appearance-none"
                    onChange={handleVillageChange}
                    value={selectedVillageId || ''}
                  >
                    <option value="">{lang === 'en' ? 'Select...' : 'اختر...'}</option>
                    {availableVillages.map(v => (
                      <option key={v.id} value={v.id}>{lang === 'en' ? v.nameEn : v.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.companyName}</label>
                <input name="company_name" className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none" value={formData.company_name} onChange={handleChange} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.email} *</label>
                <input required type="email" name="email" className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none" value={formData.email} onChange={handleChange} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">{t.auth.password} *</label>
                <input required type="password" name="password" className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-palma-primary outline-none" value={formData.password} onChange={handleChange} />
              </div>

              <div className="pt-4 flex flex-col items-center space-y-4">
                <button type="submit" disabled={loading} className="w-full py-5 bg-palma-primary text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-palma-primary/20 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50">
                  {loading ? t.common.loading : t.nav.register}
                </button>
                <button type="button" onClick={onBackToLogin} className="text-[10px] font-black uppercase text-slate-400 hover:text-palma-primary">
                  {t.common.back}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* VERIFICATION STEP */
          <div className="p-12 text-center animate-in fade-in zoom-in duration-500">
             <div className="w-20 h-20 bg-palma-green/10 text-palma-green rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-black text-slate-900 mb-2">{lang === 'en' ? 'Verify Email' : 'تحقق من البريد الإلكتروني'}</h2>
             <p className="text-slate-500 text-sm mb-6">{lang === 'en' ? `We sent a code to ${formData.email}` : `أرسلنا رمزاً إلى ${formData.email}`}</p>
             
             <form onSubmit={handleVerify} className="space-y-6 max-w-xs mx-auto">
                <input 
                  autoFocus
                  required
                  type="text" 
                  maxLength={6}
                  className="w-full p-5 text-center text-2xl font-black tracking-[0.5em] rounded-2xl border-2 border-slate-200 focus:border-palma-green outline-none transition-all placeholder:text-slate-200"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                />
                
                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

                <div className="flex flex-col gap-3">
                  <button type="submit" disabled={loading || verificationCode.length < 6} className="w-full py-4 bg-palma-primary text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl disabled:opacity-50 hover:bg-emerald-800 transition-all">
                     {loading ? t.common.loading : (lang === 'en' ? 'Verify & Login' : 'تأكيد ودخول')}
                  </button>
                  <button type="button" onClick={handleResend} disabled={loading} className="w-full py-3 bg-white text-slate-400 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                     {lang === 'en' ? 'Resend Code' : 'إعادة إرسال الرمز'}
                  </button>
                </div>
             </form>

             <button onClick={() => setStep('FORM')} className="mt-8 text-xs font-bold text-slate-400 hover:text-palma-navy flex items-center justify-center gap-2 mx-auto">
               <RefreshCcw className="w-3 h-3" /> {lang === 'en' ? 'Change Email' : 'تغيير البريد'}
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterBroker;
