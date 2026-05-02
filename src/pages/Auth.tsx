import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLegalAgreements } from '@/hooks/useLegalAgreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { acceptAgreement, getLatestVersion } = useLegalAgreements();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error('فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.');
    } else {
      toast.success('مرحباً بعودتك!');
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms || !agreedToPrivacy) {
      toast.error('يجب الموافقة على الشروط وسياسة الخصوصية');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    if (error) {
      toast.error(error.message || 'فشل إنشاء الحساب');
    } else {
      const termsVersion   = getLatestVersion('terms');
      const privacyVersion = getLatestVersion('privacy');
      if (termsVersion)   await acceptAgreement('terms',   termsVersion.version);
      if (privacyVersion) await acceptAgreement('privacy', privacyVersion.version);
      toast.success('تم إنشاء حسابك! تفقدي بريدك الإلكتروني لتأكيد الحساب.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4" dir="rtl">
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
          <p className="text-white/75 text-sm font-arabic">مساعدتك الشخصية الذكية</p>
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
                  <TabsTrigger value="signin" className="font-arabic text-sm">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="signup" className="font-arabic text-sm">حساب جديد</TabsTrigger>
                </TabsList>

                {/* ── Sign In ── */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="si-email" className="font-arabic text-sm">البريد الإلكتروني</Label>
                      <Input
                        id="si-email"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="h-11 text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="si-password" className="font-arabic text-sm">كلمة المرور</Label>
                      <Input
                        id="si-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 jood-btn-primary font-arabic text-sm mt-2"
                      disabled={loading}
                    >
                      {loading ? 'جارٍ الدخول…' : 'دخول'}
                    </Button>
                  </form>
                </TabsContent>

                {/* ── Sign Up ── */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="su-name" className="font-arabic text-sm">الاسم</Label>
                      <Input
                        id="su-name"
                        type="text"
                        placeholder="اسمك الكريم"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="h-11 font-arabic"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="font-arabic text-sm">البريد الإلكتروني</Label>
                      <Input
                        id="su-email"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="h-11 text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-password" className="font-arabic text-sm">كلمة المرور</Label>
                      <Input
                        id="su-password"
                        type="password"
                        placeholder="٦ أحرف على الأقل"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11"
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
                          أوافق على{' '}
                          <Link to="/terms" target="_blank" className="text-primary hover:underline">
                            شروط الاستخدام
                          </Link>
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
                          أوافق على{' '}
                          <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                            سياسة الخصوصية
                          </Link>
                          <span className="text-destructive mr-1">*</span>
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 jood-btn-primary font-arabic text-sm"
                      disabled={loading || !agreedToTerms || !agreedToPrivacy}
                    >
                      {loading ? 'جارٍ الإنشاء…' : 'إنشاء حساب'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-white/50 text-[11px] mt-4 font-arabic">
          متوافق مع PDPL · آمن ومشفر · محفوظ في السحابة
        </p>
      </div>
    </div>
  );
}
