import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, SUBSCRIPTION_PLANS } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Check, Star, ArrowRight, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JoodOrb } from '@/components/Voice/JoodOrb';

// ═══════════════════════════════════════════════════════════════════════════════
// Pricing — two tiers, same luxury language as the landing page
// ═══════════════════════════════════════════════════════════════════════════════

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, createCheckout, isSubscribed } = useSubscription();
  const { toast } = useToast();
  const { lang, dir } = useLanguage();
  const [loading, setLoading] = useState<string | null>(null);
  const ar = lang === 'ar';

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) { navigate('/auth'); return; }
    try {
      setLoading(priceId);
      const checkoutUrl = await createCheckout(priceId);
      window.open(checkoutUrl, '_blank');
      toast({
        title: ar ? 'جاري تحويلك للدفع' : 'Redirecting to checkout',
        description: ar ? `تجهيز اشتراك ${planName}...` : `Setting up your ${planName} subscription...`,
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: ar ? 'خطأ في الدفع' : 'Checkout Error',
        description: ar ? 'تعذر إنشاء جلسة الدفع، حاول مرة ثانية' : 'Failed to create checkout session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    { key: 'essential', plan: SUBSCRIPTION_PLANS.essential, featured: false },
    { key: 'signature', plan: SUBSCRIPTION_PLANS.signature, featured: true },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-md bg-background/80">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="font-tajawal font-bold text-lg tracking-wide" style={{ color: 'hsl(var(--jood-teal-900))' }}>
            JOOD<span style={{ color: 'hsl(var(--jood-gold-500))' }} className="mx-0.5">·</span>AI
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="text-sm gap-1.5">
            {user ? (ar ? 'لوحتي' : 'Dashboard') : (ar ? 'تسجيل الدخول' : 'Sign In')}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Button>
        </div>
      </header>

      {/* Hero strip */}
      <section className="text-center pt-10 pb-8 px-4">
        <div className="flex justify-center mb-4">
          <JoodOrb mode="idle" size={84} withRings={false} />
        </div>
        <p className="font-medium text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--jood-gold-500))' }}>
          {ar ? 'الأسعار' : 'Simple pricing'}
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold mb-2">
          {ar ? 'اختر خطتك مع جود' : 'Choose your plan with Jood'}
        </h1>
        <p className="font-arabic text-muted-foreground text-sm">
          {ar ? 'ابدأ سبعة أيام مجاناً بدون بطاقة، وألغِ متى ما تبي' : 'Start 7 days free, no card needed. Cancel anytime.'}
        </p>
      </section>

      {/* Plans */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {plans.map(({ key, plan, featured }) => {
            const current = subscription?.plan === key && isSubscribed;
            return (
              <div
                key={key}
                className="jood-card p-6 flex flex-col relative"
                style={featured ? {
                  borderColor: 'hsl(var(--jood-gold-500) / 0.45)',
                  boxShadow: '0 8px 32px rgba(184,146,74,0.18)',
                } : undefined}
              >
                {featured && (
                  <div className="absolute -top-3 inset-x-0 flex justify-center">
                    <span className="px-3 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm"
                      style={{ background: 'hsl(var(--jood-gold-500))' }}>
                      {ar ? 'الأفضل قيمة' : 'Best value'}
                    </span>
                  </div>
                )}

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4 mx-auto"
                  style={featured
                    ? { background: 'hsl(var(--jood-gold-500) / 0.12)', color: 'hsl(var(--jood-gold-600))' }
                    : { background: 'hsl(var(--jood-teal-500) / 0.1)', color: 'hsl(var(--jood-teal-700))' }}>
                  {featured && <Star className="w-3 h-3" />}
                  {ar ? plan.nameAr : plan.name}
                </div>

                <p className="font-tajawal font-bold text-4xl text-center mb-0.5">
                  {plan.price.replace('SAR ', '')}
                  <span className="text-lg font-medium text-muted-foreground mx-1.5">SAR</span>
                </p>
                <p className="text-muted-foreground text-xs text-center mb-5">
                  / {ar ? 'شهرياً' : 'month'}
                </p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {(ar ? plan.featuresAr : plan.features).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] font-arabic text-muted-foreground">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--jood-gold-500))' }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {current ? (
                  <div className="text-center text-sm font-semibold py-3 rounded-full"
                    style={{ background: 'hsl(var(--jood-ok) / 0.1)', color: 'hsl(var(--jood-ok))' }}>
                    {ar ? 'خطتك الحالية' : 'Your current plan'}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={loading === plan.priceId}
                    className={`${featured ? 'jood-btn-primary' : 'jood-btn-outline'} w-full text-sm py-3 disabled:opacity-50`}
                  >
                    {loading === plan.priceId
                      ? (ar ? 'لحظة...' : 'One moment...')
                      : (ar ? 'ابدأ التجربة المجانية' : 'Start free trial')}
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center mt-6 text-xs text-muted-foreground">
          {ar ? 'تجربة سبعة أيام مجانية، إلغاء بأي وقت، الأسعار بالريال السعودي' : '7-day free trial · Cancel anytime · Prices in Saudi Riyal'}
        </p>
      </section>

      {/* Footer strip */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-4">
          <button onClick={() => navigate('/terms')} className="hover:text-foreground transition-colors">{ar ? 'الشروط' : 'Terms'}</button>
          <button onClick={() => navigate('/privacy')} className="hover:text-foreground transition-colors">{ar ? 'الخصوصية' : 'Privacy'}</button>
        </div>
      </footer>
    </div>
  );
}
