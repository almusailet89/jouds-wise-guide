import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic, MessageSquare, TrendingUp, Calendar, Heart, Brain,
  Shield, Globe, Zap, ChevronRight, Star
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { JoodOrb } from "@/components/Voice/JoodOrb";

/* ─── Saudi Signal Strip ─────────────────────────────────────────── */
function useSaudiSignal() {
  const [data, setData] = useState({
    hijri: "", prayer: "", prayerName: "", sarUsd: "3.75", tadawul: "Open",
  });

  const refresh = useCallback(() => {
    const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date());

    fetch("https://api.aladhan.com/v1/timings?latitude=24.7136&longitude=46.6753&method=4")
      .then(r => r.json())
      .then(json => {
        const timings = json?.data?.timings;
        if (!timings) return;
        const prayers = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
        const now = new Date();
        let next = ""; let nextName = "";
        for (const p of prayers) {
          const [h, m] = timings[p].split(":").map(Number);
          const t = new Date(); t.setHours(h, m, 0, 0);
          if (t > now) { next = timings[p]; nextName = p; break; }
        }
        if (!next) { next = timings["Fajr"]; nextName = "Fajr"; }
        setData(d => ({ ...d, hijri, prayer: next, prayerName: nextName }));
      })
      .catch(() => setData(d => ({ ...d, hijri })));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return data;
}

/* ─── Features ───────────────────────────────────────────────────── */
const features = [
  { icon: MessageSquare, titleAr: "مساعد ذكي",    titleEn: "AI Chat",          descEn: "Natural bilingual conversations in Arabic and English, always on point." },
  { icon: TrendingUp,    titleAr: "تحليل مالي",    titleEn: "Financial Advisor", descEn: "Portfolio, budget, and Zakat engine built for Saudi wealth." },
  { icon: Calendar,      titleAr: "مخطط ذكي",     titleEn: "Smart Planner",     descEn: "Prayer-aware scheduling that respects your day and your deen." },
  { icon: Heart,         titleAr: "متابعة المزاج", titleEn: "Mood Tracker",      descEn: "Gentle daily check-ins with insights that actually help." },
  { icon: Mic,           titleAr: "صوت جود",       titleEn: "Jood Voice",      descEn: "Premium Saudi Arabic voice. Speaks your language, your register." },
  { icon: Brain,         titleAr: "اقتراحات ذكية", titleEn: "Smart Suggestions", descEn: "Personalised nudges based on your money, mood, and calendar." },
];

const whyPoints = [
  { icon: Globe,  titleEn: "Saudi-Native", descEn: "Hijri calendar, prayer times, Zakat engine, SAR. All built-in, not bolted on." },
  { icon: Shield, titleEn: "PDPL-Ready",   descEn: "Data processed within Kingdom frameworks. Your information stays yours.", pdpl: true },
  { icon: Zap,    titleEn: "One App",      descEn: "Money, time, wellness, and voice. One app instead of five." },
];

/* ─── Page ───────────────────────────────────────────────────────── */
export default function Index() {
  const navigate  = useNavigate();
  const signal    = useSaudiSignal();
  const { dir }   = useLanguage();
  const [micActive, setMicActive] = useState(false);

  function handleMicClick() {
    setMicActive(true);
    const audio = new Audio("/voice_preview_jood - elegente voice .mp3");
    audio.play().catch(() => {});
    setTimeout(() => setMicActive(false), 4000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" dir={dir}>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-md bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-tajawal font-bold text-xl tracking-wide" style={{ color: "hsl(var(--jood-teal-900))" }}>
            JOOD<span style={{ color: "hsl(var(--jood-gold-500))" }} className="mx-0.5">·</span>AI
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/auth')} className="jood-btn-outline text-sm px-4 py-2">Sign In</button>
            <button onClick={() => navigate('/pricing')} className="jood-btn-primary text-sm px-4 py-2">Start Free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "hsl(var(--jood-teal-900))" }}>
        {/* Islamic ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-[700px] h-[700px] text-white opacity-[0.06] animate-[islamic-rotate_60s_linear_infinite]" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.3">
            {Array.from({ length: 8 }).map((_, i) => (
              <polygon key={i} points="100,10 130,80 195,80 143,125 162,195 100,155 38,195 57,125 5,80 70,80"
                style={{ transform: `rotate(${i * 45}deg)`, transformOrigin: "100px 100px" }} />
            ))}
          </svg>
        </div>

        <div className="relative container mx-auto px-4 pt-10 pb-14 grid md:grid-cols-2 gap-8 items-center">
          {/* Text */}
          <div className="text-white entrance">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium text-white/80 mb-6">
              <Star className="w-3 h-3" style={{ color: "hsl(var(--jood-gold-300))" }} />
              مساعدتك الذكية السعودية الأولى
            </div>

            <h1 dir="rtl" className="font-tajawal font-bold text-4xl md:text-5xl leading-tight mb-2 shimmer-text">
              حيّاك الله. أنا جود.
            </h1>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-white/90 mb-4">
              Pleasure to meet you. I'm Jood.
            </h1>

            <p dir="rtl" className="font-arabic text-white/70 text-base mb-1.5 text-right">
              مال، وقت، حضور. تطبيق واحد بفهم عربي أصيل.
            </p>
            <p className="text-white/60 text-sm mb-7">
              Money, time, and presence. One app that truly gets the Saudi way.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate('/pricing')} className="jood-btn-primary text-base px-8 py-3.5">
                ابدئي التجربة المجّانية <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/auth')}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm border-2 border-white/30 text-white hover:bg-white/10 transition-colors">
                Sign In
              </button>
            </div>

            {/* Mic pill */}
            <button onClick={handleMicClick}
              className={`mt-6 inline-flex items-center gap-3 px-5 py-3 rounded-full border transition-all duration-300 ${
                micActive ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300" : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${micActive ? "animate-[gold-pulse_2s_ease-in-out_infinite]" : "bg-white/10"}`}
                style={micActive ? { background: "hsl(var(--jood-gold-500))" } : {}}>
                <Mic className="w-4 h-4" />
              </div>
              {micActive ? (
                <span className="flex items-center gap-1">
                  {[14, 20, 10, 18, 12].map((h, i) => (
                    <span key={i} className="inline-block w-1 rounded-full bg-yellow-300 animate-[avatar-breathe_0.5s_ease-in-out_infinite]"
                      style={{ height: h, animationDelay: `${i * 80}ms` }} />
                  ))}
                </span>
              ) : (
                <span className="text-sm">اسمعي كيف أتكلم</span>
              )}
            </button>
          </div>

          {/* The Jood Orb — النواة — signature Saudi AI presence */}
          <div className="flex justify-center entrance entrance-delay-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-3xl scale-110 opacity-25" style={{ background: "hsl(var(--jood-gold-500))" }} />
              <JoodOrb
                mode={micActive ? 'speaking' : 'idle'}
                size={typeof window !== 'undefined' && window.innerWidth < 768 ? 220 : 300}
                withRings
                className="relative"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Saudi Signal Strip */}
      <div className="border-y border-border/40 bg-card/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-3">
          {signal.hijri && (
            <span className="signal-chip">
              <span style={{ color: "hsl(var(--jood-gold-500))" }}>☽</span>
              <span dir="rtl" className="font-arabic">{signal.hijri}</span>
            </span>
          )}
          {signal.prayerName && (
            <span className="signal-chip">🕌 {signal.prayerName} · {signal.prayer}</span>
          )}
          <span className="signal-chip">﷼ SAR / USD · {signal.sarUsd}</span>
          <span className="signal-chip">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(var(--jood-ok))" }} />
            Tadawul · {signal.tadawul}
          </span>
        </div>
      </div>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-14">
        <div className="text-center mb-9 entrance">
          <p className="font-medium text-sm uppercase tracking-widest mb-3" style={{ color: "hsl(var(--jood-gold-500))" }}>What Jood does</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">Everything. In one elegant app.</h2>
          <p dir="rtl" className="font-arabic text-muted-foreground text-lg">كل شي تحتاجه في مكان واحد</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className={`jood-card p-5 entrance entrance-delay-${i + 1}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "hsl(var(--jood-teal-900))" }}>
                <f.icon className="w-5 h-5" style={{ color: "hsl(var(--jood-gold-500))" }} />
              </div>
              <p dir="rtl" className="font-arabic text-sm text-muted-foreground mb-1 text-right">{f.titleAr}</p>
              <h3 className="font-semibold text-lg mb-2">{f.titleEn}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.descEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why JOOD */}
      <section className="py-14" style={{ background: "hsl(var(--jood-teal-900))" }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-9 entrance">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-2">Why JOOD?</h2>
            <p dir="rtl" className="font-arabic text-white/60 text-lg">مصنوعة للسعودي، بفهم سعودي</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {whyPoints.map((w, i) => (
              <div key={i} className={`entrance entrance-delay-${i + 1} rounded-2xl border border-white/10 bg-white/5 p-6 text-center`}>
                <div className="w-12 h-12 rounded-full border flex items-center justify-center mx-auto mb-4"
                  style={{ borderColor: "hsl(var(--jood-gold-500) / 0.4)", background: "hsl(var(--jood-gold-500) / 0.1)" }}>
                  <w.icon className="w-5 h-5" style={{ color: "hsl(var(--jood-gold-300))" }} />
                </div>
                <h3 className="font-semibold text-white text-lg mb-2">{w.titleEn}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{w.descEn}</p>
                {w.pdpl && <p className="mt-3 text-xs" style={{ color: "hsl(var(--jood-gold-500) / 0.8)" }}>PDPL-registered · SDAIA Ethics</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — two tiers */}
      <section className="container mx-auto px-4 py-14 text-center">
        <p className="font-medium text-sm uppercase tracking-widest mb-2" style={{ color: "hsl(var(--jood-gold-500))" }}>Simple pricing</p>
        <p dir="rtl" className="font-arabic text-muted-foreground text-sm mb-8">ابدأ سبعة أيام مجاناً بدون بطاقة</p>

        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto entrance">
          {/* Essential */}
          <div className="jood-card p-6 text-center flex flex-col">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 mx-auto"
              style={{ background: "hsl(var(--jood-teal-500) / 0.1)", color: "hsl(var(--jood-teal-700))" }}>
              Jood Essential
            </div>
            <p className="font-tajawal font-bold text-4xl mb-0.5">
              29 <span className="text-lg font-medium text-muted-foreground">SAR</span>
            </p>
            <p className="text-muted-foreground text-xs mb-4">/ month</p>
            <ul dir="rtl" className="font-arabic text-[13px] text-muted-foreground space-y-1.5 text-right mb-5 flex-1">
              <li>محادثة ذكية غير محدودة، عربي وإنجليزي</li>
              <li>عشرون دقيقة مجلس صوتي شهرياً</li>
              <li>التقويم والمالية والمزاج والعادات</li>
              <li>الموجز اليومي من جود</li>
            </ul>
            <button onClick={() => navigate('/pricing')} className="jood-btn-outline w-full text-sm py-3">
              ابدأ التجربة
            </button>
          </div>

          {/* Signature — highlighted */}
          <div className="jood-card p-6 text-center flex flex-col relative"
            style={{ borderColor: "hsl(var(--jood-gold-500) / 0.45)", boxShadow: "0 8px 32px rgba(184,146,74,0.18)" }}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 mx-auto"
              style={{ background: "hsl(var(--jood-gold-500) / 0.12)", color: "hsl(var(--jood-gold-600))" }}>
              <Star className="w-3 h-3" /> Jood Signature
            </div>
            <p className="font-tajawal font-bold text-4xl mb-0.5">
              33 <span className="text-lg font-medium text-muted-foreground">SAR</span>
            </p>
            <p className="text-muted-foreground text-xs mb-4">/ month</p>
            <ul dir="rtl" className="font-arabic text-[13px] text-muted-foreground space-y-1.5 text-right mb-5 flex-1">
              <li>كل مزايا Essential</li>
              <li>ستون دقيقة مجلس صوتي شهرياً</li>
              <li>ذكاء متقدم للمحادثات النصية</li>
              <li>ذاكرة موسعة وخصوصية معززة</li>
              <li>أولوية في الدعم والمزايا الجديدة</li>
            </ul>
            <button onClick={() => navigate('/pricing')} className="jood-btn-primary w-full text-sm py-3">
              ابدأ التجربة <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">7-day free trial · Cancel anytime</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40">
        <div className="container mx-auto px-4 py-7">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-tajawal font-bold text-lg" style={{ color: "hsl(var(--jood-teal-900))" }}>
                JOOD<span style={{ color: "hsl(var(--jood-gold-500))" }} className="mx-0.5">·</span>AI
              </span>
              <p className="text-xs text-muted-foreground mt-1">مساعدتك الذكية السعودية · Your Saudi AI companion</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <button onClick={() => navigate('/terms')} className="hover:text-foreground transition-colors">Terms</button>
              <button onClick={() => navigate('/privacy')} className="hover:text-foreground transition-colors">Privacy</button>
              <button onClick={() => navigate('/pricing')} className="hover:text-foreground transition-colors">Pricing</button>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} JOOD AI. All rights reserved.</p>
            <p>PDPL-compliant · SDAIA AI Ethics · CITC licensed (pending)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
