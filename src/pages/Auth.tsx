import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLegalAgreements } from '@/hooks/useLegalAgreements';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Auth() {
  const { t, dir } = useLanguage();

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [displayName, setDisplayName]         = useState('');
  const [gender, setGender]                   = useState<'male' | 'female' | ''>('');
  const [phone, setPhone]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [agreedToTerms, setAgreedToTerms]     = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showForgot, setShowForgot]           = useState(false);
  const [resetEmail, setResetEmail]           = useState('');
  const [resetSent, setResetSent]             = useState(false);
  const [resetLoading, setResetLoading]       = useState(false);

  const { signIn, signUp, user, resetPassword } = useAuth();
  const { acceptAgreement, getLatestVersion } = useLegalAgreements();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);
    if (error) {
      toast.error(t('auth.reset.error'));
    } else {
      setResetSent(true);
      toast.success(t('auth.reset.success'));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(t('auth.error.signin'));
    } else {
      toast.success(t('auth.welcome.back'));
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error(t('auth.error.name')); return; }
    if (!gender) { toast.error(t('auth.error.gender')); return; }
    if (!agreedToTerms || !agreedToPrivacy) {
      toast.error(t('auth.error.legal'));
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, displayName, gender, phone || undefined);
    if (error) {
      toast.error(error.message || t('auth.error.signup'));
    } else {
      const termsVersion   = getLatestVersion('terms');
      const privacyVersion = getLatestVersion('privacy');
      if (termsVersion)   await acceptAgreement('terms',   termsVersion.version);
      if (privacyVersion) await acceptAgreement('privacy', privacyVersion.version);
      toast.success(t('auth.success.signup'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jood-gold-500 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-gold">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-arabic mb-1">جود AI</h1>
          <p className="text-white/75 text-sm font-arabic">{t('auth.tagline')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-card/95 backdrop-blur border-white/10 shadow-luxury">
            <CardContent className="p-5">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 h-10">
                  <TabsTrigger value="signin"  className="font-arabic text-sm">{t('auth.signin')}</TabsTrigger>
                  <TabsTrigger value="signup"  className="font-arabic text-sm">{t('auth.signup')}</TabsTrigger>
                </TabsList>

                {/* ── Sign In ── */}
                <TabsContent value="signin">
                  {showForgot ? (
                    <div className="space-y-4">
                      {resetSent ? (
                        <div className="text-center space-y-3 py-2">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6 text-emerald-600" />
                          </div>
                          <p className="font-arabic text-sm text-muted-foreground">{t('auth.reset.success')}</p>
                        </div>
                      ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                          <div className="space-y-1">
                            <p className="font-arabic text-sm font-semibold">{t('auth.reset.title')}</p>
                            <p className="font-arabic text-xs text-muted-foreground">{t('auth.reset.desc')}</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="reset-email" className="font-arabic text-sm">{t('auth.email')}</Label>
                            <Input
                              id="reset-email" type="email" placeholder="example@email.com"
                              value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                              required className="h-11 text-left text-base" dir="ltr"
                              autoFocus
                            />
                          </div>
                          <Button type="submit" className="w-full h-11 jood-btn-primary font-arabic text-sm" disabled={resetLoading}>
                            {resetLoading ? t('auth.reset.sending') : t('auth.reset.send')}
                          </Button>
                        </form>
                      )}
                      <button
                        type="button"
                        onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail(''); }}
                        className="flex items-center gap-1 text-xs font-arabic text-muted-foreground hover:text-foreground transition-colors mx-auto"
                      >
                        <ArrowRight className="w-3 h-3" />
                        {t('auth.reset.back')}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="si-email" className="font-arabic text-sm">{t('auth.email')}</Label>
                        <Input
                          id="si-email" type="email" placeholder="example@email.com"
                          value={email} onChange={e => setEmail(e.target.value)}
                          required className="h-11 text-left text-base" dir="ltr"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="si-password" className="font-arabic text-sm">{t('auth.password')}</Label>
                          <button
                            type="button"
                            onClick={() => setShowForgot(true)}
                            className="text-[11px] font-arabic text-muted-foreground hover:text-primary transition-colors"
                          >
                            {t('auth.forgot')}
                          </button>
                        </div>
                        <Input
                          id="si-password" type="password" placeholder="••••••••"
                          value={password} onChange={e => setPassword(e.target.value)}
                          required className="h-11 text-base"
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 jood-btn-primary font-arabic text-sm mt-2" disabled={loading}>
                        {loading ? t('auth.signing.in') : t('auth.enter')}
                      </Button>
                    </form>
                  )}
                </TabsContent>

                {/* ── Sign Up ── */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">

                    {/* Name — REQUIRED */}
                    <div className="space-y-1.5">
                      <Label htmlFor="su-name" className="font-arabic text-sm">
                        {t('auth.name')} <span className="text-destructive text-xs">*</span>
                      </Label>
                      <Input
                        id="su-name" type="text" placeholder={t('auth.name.placeholder')}
                        value={displayName} onChange={e => setDisplayName(e.target.value)}
                        required className="h-11 font-arabic text-base"
                      />
                    </div>

                    {/* Gender — REQUIRED */}
                    <div className="space-y-1.5">
                      <Label className="font-arabic text-sm flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-jood-gold-500" />
                        {t('auth.gender')}
                        <span className="text-destructive text-xs">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['female', 'male'] as const).map(g => (
                          <button
                            key={g} type="button"
                            onClick={() => setGender(g)}
                            className={cn(
                              'h-11 rounded-xl border-2 font-arabic text-sm font-semibold transition-all',
                              gender === g
                                ? g === 'female'
                                  ? 'border-pink-400 bg-pink-50 text-pink-700'
                                  : 'border-primary bg-primary/5 text-primary'
                                : 'border-border text-muted-foreground hover:border-border/60',
                            )}
                          >
                            {g === 'female' ? t('auth.gender.female') : t('auth.gender.male')}
                          </button>
                        ))}
                      </div>
                      {gender && (
                        <p className="text-[11px] text-muted-foreground font-arabic">
                          {gender === 'female' ? t('auth.gender.hint.female') : t('auth.gender.hint.male')}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="font-arabic text-sm">
                        {t('auth.email')} <span className="text-destructive text-xs">*</span>
                      </Label>
                      <Input
                        id="su-email" type="email" placeholder="example@email.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        required className="h-11 text-left text-base" dir="ltr"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="su-password" className="font-arabic text-sm">
                        {t('auth.password')} <span className="text-destructive text-xs">*</span>
                      </Label>
                      <Input
                        id="su-password" type="password" placeholder={t('auth.password.placeholder')}
                        value={password} onChange={e => setPassword(e.target.value)}
                        required minLength={6} className="h-11 text-base"
                      />
                    </div>

                    {/* Phone — optional */}
                    <div className="space-y-1.5">
                      <Label htmlFor="su-phone" className="font-arabic text-sm text-muted-foreground">
                        {t('auth.phone')} <span className="text-xs">{t('auth.phone.optional')}</span>
                      </Label>
                      <Input
                        id="su-phone" type="tel" placeholder="+966 5x xxx xxxx"
                        value={phone} onChange={e => setPhone(e.target.value)}
                        className="h-11 text-left text-base" dir="ltr"
                      />
                    </div>

                    {/* Legal */}
                    <div className="space-y-3 pt-3 border-t border-border/40">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms-agreement"
                          checked={agreedToTerms}
                          onCheckedChange={c => setAgreedToTerms(c === true)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="terms-agreement" className="text-xs font-arabic leading-relaxed text-muted-foreground">
                          {t('auth.terms')}{' '}
                          <Link to="/terms" target="_blank" className="text-primary hover:underline">{t('auth.terms.link')}</Link>
                          <span className="text-destructive mr-1">*</span>
                        </Label>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="privacy-agreement"
                          checked={agreedToPrivacy}
                          onCheckedChange={c => setAgreedToPrivacy(c === true)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="privacy-agreement" className="text-xs font-arabic leading-relaxed text-muted-foreground">
                          {t('auth.terms')}{' '}
                          <Link to="/privacy" target="_blank" className="text-primary hover:underline">{t('auth.privacy.link')}</Link>
                          <span className="text-destructive mr-1">*</span>
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 jood-btn-primary font-arabic text-sm"
                      disabled={loading || !agreedToTerms || !agreedToPrivacy || !displayName || !gender}
                    >
                      {loading ? t('auth.creating') : t('auth.create')}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-white/50 text-[11px] mt-4 font-arabic">
          {t('auth.pdpl')}
        </p>
      </div>
    </div>
  );
}
