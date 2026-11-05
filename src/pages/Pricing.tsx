import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JoodOrb } from '@/components/Voice/JoodOrb';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, dir } = useLanguage();
  const ar = lang === 'ar';
  const benefits = ar
    ? ['الوصول المبكر للمزايا الجاهزة', 'فرصة للتأثير على تطوير جود', 'إشعار واضح قبل إطلاق أي اشتراك مدفوع']
    : ['Early access to ready features', 'A chance to shape Jood’s development', 'Clear notice before any paid plan launches'];

  return (
    <div className="min-h-screen jood-ambient text-foreground" dir={dir}>
      <header className="glass border-x-0 border-t-0">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="font-tajawal font-bold text-lg tracking-wide text-jood-teal-900 dark:text-jood-cream">
            JOOD<span className="mx-0.5 text-jood-gold-500">·</span>AI
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="gap-1.5">
            {user ? (ar ? 'لوحتي' : 'Dashboard') : (ar ? 'تسجيل الدخول' : 'Sign In')}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-14">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-5"><JoodOrb mode="idle" size={88} withRings={false} /></div>
          <p className="text-sm font-arabic text-jood-gold-600 dark:text-jood-gold-300 mb-2">{ar ? 'نسخة تجريبية خاصة' : 'Private beta'}</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {ar ? 'جود حالياً في نسخة تجريبية محدودة' : 'Jood is currently in private beta'}
          </h1>
          <p className="font-arabic text-muted-foreground leading-7 mb-8">
            {ar
              ? 'نختبر المحادثة والتخطيط والتذكيرات والخصوصية مع مجموعة صغيرة من المستخدمين قبل تفعيل الاشتراكات المدفوعة.'
              : 'We are testing chat, planning, reminders, and privacy with a small group before enabling paid subscriptions.'}
          </p>

          <div className="jood-card p-6 text-start mb-7">
            {benefits.map(item => (
              <div key={item} className="flex items-start gap-3 py-2 font-arabic text-sm">
                <CheckCircle2 className="w-5 h-5 text-jood-teal-600 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="jood-btn-primary px-8">
            {user ? (ar ? 'افتح جود' : 'Open Jood') : (ar ? 'انضم للنسخة التجريبية' : 'Join the beta')}
          </Button>
          <p className="text-xs text-muted-foreground mt-5">
            {ar ? 'لا توجد رسوم أو اشتراكات مفعّلة من هذه الصفحة.' : 'No fees or subscriptions are activated from this page.'}
          </p>
        </div>
      </main>
    </div>
  );
}
