import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { userService } from '../services/userService';
import { useToast } from './ToastProvider';
import { User } from '../types';
import { Language, translations } from '../translations';

interface VerifyEmailProps {
  user: User;
  onLogout: () => void;
  lang: Language;
  onVerified: () => void;
}

export const VerifyEmail: React.FC<VerifyEmailProps> = ({ user, onLogout, lang, onVerified }) => {
  const t = translations[lang];
  const { showToast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    try {
      const result = await userService.resendVerificationCode(user.email);
      if (result.success) {
        showToast(lang === 'ar' ? 'تم إرسال رمز التحقق بنجاح' : 'Verification code sent successfully', 'success');
        setCountdown(60);
      } else {
        showToast(result.error || 'Failed to resend code', 'error');
      }
    } catch (error) {
      showToast('Error resending code', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) return;

    setIsVerifying(true);
    try {
      const result = await userService.verifyEmail(user.email, otpCode);
      if (result.success) {
        showToast(lang === 'ar' ? 'تم التحقق من البريد الإلكتروني بنجاح' : 'Email verified successfully', 'success');
        onVerified();
      } else {
        showToast(result.error || 'Invalid verification code', 'error');
      }
    } catch (error) {
      showToast('Verification failed', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-palma-primary p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-30"></div>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 relative z-10">
            {lang === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email'}
          </h2>
          <p className="text-white/80 text-sm relative z-10">
            {lang === 'ar' ? 'لقد أرسلنا رمز التحقق إلى:' : 'We sent a verification code to:'}
          </p>
            <div className="mt-2 inline-block bg-black/20 px-3 py-1 rounded-full text-white text-sm font-medium relative z-10">
              {user.email}
            </div>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            <p className="text-slate-600 text-sm leading-relaxed">
              {lang === 'ar' 
                ? 'الرجاء إدخال رمز التحقق المكون من 6 أرقام الذي تم إرساله إلى بريدك الإلكتروني للمتابعة.' 
                : 'Please enter the 6-digit verification code sent to your email address to continue.'}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {lang === 'ar' ? 'رمز التحقق' : 'Verification Code'}
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 border-2 border-slate-200 rounded-xl focus:border-palma-primary focus:ring-0 transition-colors"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpCode.length < 6}
              className="w-full bg-palma-primary text-white py-3.5 rounded-xl font-bold hover:bg-palma-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-palma-primary/20"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>{lang === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>{lang === 'ar' ? 'تأكيد الرمز' : 'Verify Code'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-4">
              {lang === 'ar' ? 'لم تستلم الرمز؟' : "Didn't receive the code?"}
            </p>
            <button
              onClick={handleResend}
              disabled={isResending || countdown > 0}
              className="text-palma-primary font-semibold hover:text-palma-primary/80 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2 mx-auto"
            >
              {isResending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {countdown > 0 
                ? (lang === 'ar' ? `إعادة الإرسال خلال ${countdown} ثانية` : `Resend in ${countdown}s`)
                : (lang === 'ar' ? 'إعادة إرسال الرمز' : 'Resend Code')
              }
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-slate-600 text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
