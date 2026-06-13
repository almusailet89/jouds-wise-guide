import React, { useState, lazy, Suspense, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/hooks/useLanguage';
import { useSubscription } from '@/hooks/useSubscription';
import { useEventReminders } from '@/hooks/useEventReminders';
import { useRoles } from '@/hooks/useRoles';
import { Button } from '@/components/ui/button';
import { HomeOverview } from '@/components/Home/HomeOverview';
import { JoodOrb } from '@/components/Voice/JoodOrb';
import { useNavigate } from 'react-router-dom';

// Heavy tab components — loaded only when the user first visits that tab
const FinancialDashboard = lazy(() => import('@/components/Dashboard/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const MoodTracker        = lazy(() => import('@/components/Mood/MoodTracker'));
const ExportPanel        = lazy(() => import('@/components/Export/ExportPanel').then(m => ({ default: m.ExportPanel })));
const PlanningHub        = lazy(() => import('@/components/Planning/PlanningHub'));
const SettingsHub        = lazy(() => import('@/components/Settings/SettingsHub'));

// Chat tab — react-markdown + react-syntax-highlighter are heavy; load on demand
const ChatInterface  = lazy(() => import('@/components/Chat/ChatInterface').then(m => ({ default: m.ChatInterface })));

// Overlay / on-demand components — loaded only when actually opened
// ElevenLabs Conversational AI Agent — replaces old pipeline for real-time voice
const MajlisMode   = lazy(() => import('@/components/Voice/MajlisModeAgent'));
const Onboarding   = lazy(() => import('@/components/Onboarding/Onboarding'));
const ProfileDialog = lazy(() => import('@/components/Profile/ProfileDialog'));
// Voice panel loaded when user switches to voice mode
const VoicePanel   = lazy(() => import('@/components/Voice/VoicePanel'));
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, TrendingUp, Heart, Home,
  LogOut, Mic, Download, Sparkles, CalendarCheck, Settings, Bell, Moon, Sun, FlaskConical, ShieldCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// ─── Saudi Signal Strip ───────────────────────────────────────────────────────
const SIGNAL_PRAYER_KEYS: Record<string, string> = {
  Fajr: 'home.prayer.fajr', Dhuhr: 'home.prayer.dhuhr',
  Asr: 'home.prayer.asr', Maghrib: 'home.prayer.maghrib', Isha: 'home.prayer.isha',
};

const useSaudiSignal = () => {
  const [hijri, setHijri] = React.useState('');
  const [prayer, setPrayer] = React.useState<{ key: string; time: string } | null>(null);
  const [sarUsd, setSarUsd] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Hijri date
    try {
      const h = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(new Date());
      setHijri(h);
    } catch { setHijri(''); }

    // Prayer times
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4')
      .then(r => r.json())
      .then(d => {
        const timings = d?.data?.timings;
        if (!timings) return;
        const entries: [string, string][] = [
          ['Fajr', timings.Fajr], ['Dhuhr', timings.Dhuhr], ['Asr', timings.Asr],
          ['Maghrib', timings.Maghrib], ['Isha', timings.Isha],
        ];
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const next = entries.find(([, time]) => {
          const [h2, m2] = time.split(':').map(Number);
          return h2 * 60 + m2 > nowMin;
        });
        if (next) setPrayer({ key: SIGNAL_PRAYER_KEYS[next[0]] ?? 'home.prayer.fajr', time: next[1] });
      }).catch(() => {});

    // SAR/USD live rate (free API, no key required)
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => {
        const rate = d?.rates?.SAR;
        if (rate) setSarUsd(Number(rate).toFixed(2));
      })
      .catch(() => setSarUsd('3.75')); // fallback to peg
  }, []);

  return { hijri, prayer, sarUsd };
};

// ─── Nav items (6 tabs) — built at render time so labels are translated ───────
const buildNav = (t: (k: string) => string) => [
  { value: 'home',      label: t('nav.home'),      icon: Home },
  { value: 'chat',      label: t('nav.chat'),      icon: MessageSquare },
  { value: 'financial', label: t('nav.financial'), icon: TrendingUp },
  { value: 'planning',  label: t('nav.planning'),  icon: CalendarCheck },
  { value: 'mood',      label: t('nav.mood'),      icon: Heart },
  { value: 'settings',  label: t('nav.settings'),  icon: Settings },
  // Dev-only sandbox tab — never shown to production users
  ...(import.meta.env.DEV ? [{ value: 'test', label: 'Test', icon: FlaskConical }] : []),
];

// ─── Lazy tab skeleton ────────────────────────────────────────────────────────
const TabSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-8 bg-muted/50 rounded-xl w-1/3" />
    <div className="h-32 bg-muted/30 rounded-2xl" />
    <div className="h-24 bg-muted/20 rounded-2xl" />
  </div>
);

// ─── Chat+Voice tab ───────────────────────────────────────────────────────────
const ChatVoiceTab: React.FC<{ onMajlis: () => void }> = ({ onMajlis }) => {
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-160px)]">
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/30">
          <button
            onClick={() => setMode('chat')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-arabic transition-all',
              mode === 'chat' ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MessageSquare className="w-4 h-4" />
            {t('chat.mode.chat')}
          </button>
          <button
            onClick={() => setMode('voice')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-arabic transition-all',
              mode === 'voice' ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Mic className="w-4 h-4" />
            {t('chat.mode.voice')}
          </button>
        </div>

        {mode === 'voice' && (
          <Button
            onClick={onMajlis}
            size="sm"
            className="bg-gradient-to-r from-jood-gold-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white gap-2 font-arabic shadow-luxury h-9 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('chat.majlis.full')}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {mode === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Suspense fallback={<TabSkeleton />}>
                <ChatInterface />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
            >
              <Suspense fallback={<TabSkeleton />}>
                <VoicePanel />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Page-level fade wrapper ──────────────────────────────────────────────────
const Fade: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

// ─── Mobile bottom nav bar ─────────────────────────────────────────────────────
const MobileBottomNav: React.FC<{ activeTab: string; onTabChange: (t: string) => void }> = ({ activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const NAV = buildNav(t);
  return (
  <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-jood-gold-500/15 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-pb">
    <div className="flex items-center justify-around px-1 py-1.5">
      {NAV.map(({ value, label, icon: Icon }) => {
        const active = activeTab === value;
        return (
          <button
            key={value}
            onClick={() => onTabChange(value)}
            className={cn(
              'relative flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 min-w-[52px]',
              active ? 'text-jood-teal-700 dark:text-jood-gold-300' : 'text-muted-foreground',
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-9 h-7 rounded-full transition-all duration-200',
              active && 'bg-jood-gold-500/12 ring-1 ring-jood-gold-500/25 shadow-[0_0_10px_rgba(184,146,74,0.15)]',
            )}>
              <Icon className={cn('w-[18px] h-[18px] transition-transform duration-200', active && 'scale-105')} strokeWidth={active ? 2.2 : 1.8} />
            </span>
            <span className={cn(
              'text-[9px] font-arabic leading-none transition-colors',
              active ? 'font-bold' : 'text-muted-foreground',
            )}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { theme, setTheme } = useTheme();
  const { t, lang, dir } = useLanguage();
  const { hasPaymentIssue, openCustomerPortal } = useSubscription();
  const { isAdmin } = useRoles();
  const navigate = useNavigate();
  useEventReminders(); // fires event reminders (browser notification + toast) while app is open
  const NAV = buildNav(t);
  const [activeTab, setActiveTab] = useState('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const { hijri, prayer, sarUsd } = useSaudiSignal();
  // Check localStorage first (fast), then sync from DB profile once loaded
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('jood.onboarding.done') !== '1';
  });
  // Once profile loads, respect DB flag too (cross-device support)
  React.useEffect(() => {
    if (!profile) return;
    if ((profile as any).onboarding_done === true) {
      localStorage.setItem('jood.onboarding.done', '1');
      setShowOnboarding(false);
    }
  }, [(profile as any)?.onboarding_done]);
  const [majlisOpen, setMajlisOpen] = useState(false);

  // Phase 4: Listen for Jood navigation commands from chat
  React.useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab && ['home','chat','financial','planning','mood','settings'].includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('jood:navigate', handler);
    return () => window.removeEventListener('jood:navigate', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>

      {showOnboarding && (
        <Suspense fallback={null}>
          <Onboarding onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </Suspense>

      {/* Payment issue banner — shown when Stripe subscription is past_due */}
      {hasPaymentIssue && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs font-arabic text-destructive">
            {t('pay.issue')}
          </p>
          <button
            onClick={() => openCustomerPortal().catch(() => {})}
            className="text-xs font-arabic font-semibold text-destructive underline underline-offset-2 flex-shrink-0"
          >
            {t('pay.update')}
          </button>
        </div>
      )}

      {/* Gender nudge — shown once if user hasn't set gender yet */}
      {!profile?.gender && profile !== null && (
        <div className="bg-jood-gold-500/10 border-b border-jood-gold-500/20 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs font-arabic text-jood-gold-700 dark:text-jood-gold-300">
            {t('nudge.gender')}
          </p>
          <button
            onClick={() => setProfileOpen(true)}
            className="text-xs font-arabic font-semibold text-jood-gold-700 dark:text-jood-gold-300 underline underline-offset-2 flex-shrink-0"
          >
            {t('nudge.complete')}
          </button>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto px-3 py-2 max-w-screen-2xl flex items-center gap-3">

          {/* Brand — living orb mark */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shadow-elegant">
              <JoodOrb mode="idle" size={36} withRings={false} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground font-arabic leading-none">جود AI</h1>
              <p className="hidden sm:block text-[10px] text-muted-foreground leading-none mt-0.5">{t('header.tagline')}</p>
            </div>
          </div>

          {/* Saudi Signal Strip */}
          <div className="hidden md:flex items-center gap-3 mx-auto">
            {hijri && (
              <span className="signal-chip font-arabic text-[11px]">🌙 {hijri}</span>
            )}
            {prayer && (
              <span className="signal-chip font-arabic text-[11px]">🕌 {t(prayer.key)} {prayer.time}</span>
            )}
            {sarUsd && (
              <span className="signal-chip text-[11px] font-mono">SAR/USD {sarUsd}</span>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 mr-auto">
            {/* Admin control centre — visible to admins only */}
            {isAdmin() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="h-8 gap-1.5 text-jood-gold-600 hover:text-jood-gold-700 hover:bg-jood-gold-500/10 border border-jood-gold-300/40 rounded-full ltr:pl-2 ltr:pr-3 rtl:pr-2 rtl:pl-3"
                title="Admin Control Centre"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-semibold">Admin</span>
              </Button>
            )}

            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Notification bell */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('settings')}
              className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMajlisOpen(true)}
              className="h-8 gap-1.5 text-jood-gold-600 hover:text-jood-gold-700 hover:bg-jood-gold-500/10 border border-jood-gold-300/40 rounded-full ltr:pl-1 ltr:pr-3 rtl:pr-1 rtl:pl-3"
            >
              <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                <JoodOrb mode="idle" size={24} withRings={false} />
              </span>
              <span className="hidden sm:inline text-xs font-arabic font-bold">{t('header.majlis')}</span>
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs font-arabic">{t('header.export')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-arabic">{t('export.title')}</DialogTitle>
                </DialogHeader>
                <Suspense fallback={<TabSkeleton />}>
                  <ExportPanel />
                </Suspense>
              </DialogContent>
            </Dialog>

            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/40"
              title="الملف الشخصي"
            >
              <span className="text-base leading-none">{profile?.avatar_emoji || '👤'}</span>
              <span className="text-xs hidden sm:inline font-arabic">
                {profile?.display_name || user?.email?.split('@')[0]}
              </span>
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 text-muted-foreground hover:text-destructive gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-arabic">{t('header.logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col max-w-screen-2xl mx-auto w-full pb-16 sm:pb-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">

          {/* Tab nav — desktop only; mobile uses bottom bar */}
          <div className="hidden sm:block px-4 pt-4">
            <TabsList className="bg-card/60 border border-border/40 backdrop-blur-sm h-auto p-1 gap-0.5 rounded-2xl">
              {NAV.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'gap-1.5 px-4 py-2 rounded-xl text-sm font-arabic transition-all duration-200',
                    'data-[state=active]:bg-jood-teal-900 data-[state=active]:text-white data-[state=active]:shadow-elegant',
                    'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Home ──────────────────────────────────────────────────────── */}
          <TabsContent value="home" className="p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.home')} lang={lang}>
              <Fade><HomeOverview onNavigate={setActiveTab} /></Fade>
            </ErrorBoundary>
          </TabsContent>

          {/* ── Chat + Voice ──────────────────────────────────────────────── */}
          <TabsContent value="chat" className="flex-1 p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.chat')} lang={lang}>
              <ChatVoiceTab onMajlis={() => setMajlisOpen(true)} />
            </ErrorBoundary>
          </TabsContent>

          {/* ── Finance ──────────────────────────────────────────────────── */}
          <TabsContent value="financial" className="p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.finance')} lang={lang}>
              <Suspense fallback={<TabSkeleton />}>
                <Fade><FinancialDashboard /></Fade>
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          {/* ── Planning (Calendar + Tasks + Habits) ─────────────────────── */}
          <TabsContent value="planning" className="p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.planning')} lang={lang}>
              <Suspense fallback={<TabSkeleton />}>
                <Fade>
                  <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">{t('tab.planning')}</h2>
                  <PlanningHub />
                </Fade>
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          {/* ── Mood ─────────────────────────────────────────────────────── */}
          <TabsContent value="mood" className="p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.mood')} lang={lang}>
              <Suspense fallback={<TabSkeleton />}>
                <Fade>
                  <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">{t('tab.mood')}</h2>
                  <MoodTracker />
                </Fade>
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          {/* ── Test ─────────────────────────────────────────────────────── */}
          <TabsContent value="test" className="p-4 mt-0">
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-foreground text-lg font-semibold">Test Tab ✓</p>
            </div>
          </TabsContent>

          {/* ── Settings (Insights + Memory + Security) ───────────────────── */}
          <TabsContent value="settings" className="p-4 mt-0">
            <ErrorBoundary fallbackLabel={t('error.load.settings')} lang={lang}>
              <Suspense fallback={<TabSkeleton />}>
                <Fade>
                  <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">{t('tab.settings')}</h2>
                  <SettingsHub onNavigate={setActiveTab} />
                </Fade>
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────────────────── */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Majlis overlay ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {majlisOpen && (
          <Suspense fallback={null}>
            <MajlisMode onClose={() => setMajlisOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
