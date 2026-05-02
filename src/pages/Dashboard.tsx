import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { VoicePanel } from '@/components/Voice/VoicePanel';
import { HomeOverview } from '@/components/Home/HomeOverview';
import Onboarding from '@/components/Onboarding/Onboarding';
import MajlisMode from '@/components/Voice/MajlisMode';

// Heavy tab components — loaded only when the user first visits that tab
const FinancialDashboard = lazy(() => import('@/components/Dashboard/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const MoodTracker        = lazy(() => import('@/components/Mood/MoodTracker'));
const ExportPanel        = lazy(() => import('@/components/Export/ExportPanel').then(m => ({ default: m.ExportPanel })));
const PlanningHub        = lazy(() => import('@/components/Planning/PlanningHub'));
const SettingsHub        = lazy(() => import('@/components/Settings/SettingsHub'));
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, TrendingUp, Heart, Home,
  LogOut, User, Mic, Download, Sparkles, CalendarCheck, Settings, Bell, Moon, Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// ─── Saudi Signal Strip ───────────────────────────────────────────────────────
const useSaudiSignal = () => {
  const [hijri, setHijri] = React.useState('');
  const [prayer, setPrayer] = React.useState<{ name: string; time: string } | null>(null);

  React.useEffect(() => {
    try {
      const h = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(new Date());
      setHijri(h);
    } catch { setHijri(''); }

    fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4')
      .then(r => r.json())
      .then(d => {
        const t = d?.data?.timings;
        if (!t) return;
        const names: [string, string][] = [
          ['الفجر', t.Fajr], ['الظهر', t.Dhuhr], ['العصر', t.Asr],
          ['المغرب', t.Maghrib], ['العشاء', t.Isha],
        ];
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const next = names.find(([, time]) => {
          const [h2, m2] = time.split(':').map(Number);
          return h2 * 60 + m2 > nowMin;
        });
        if (next) setPrayer({ name: next[0], time: next[1] });
      }).catch(() => {});
  }, []);

  return { hijri, prayer };
};

// ─── Nav items (6 tabs) ───────────────────────────────────────────────────────
const NAV = [
  { value: 'home',      label: 'الرئيسية',  icon: Home },
  { value: 'chat',      label: 'جود AI',    icon: MessageSquare },
  { value: 'financial', label: 'المالية',   icon: TrendingUp },
  { value: 'planning',  label: 'تخطيطي',    icon: CalendarCheck },
  { value: 'mood',      label: 'المزاج',    icon: Heart },
  { value: 'settings',  label: 'الإعدادات', icon: Settings },
];

// ─── Chat+Voice tab ───────────────────────────────────────────────────────────
const ChatVoiceTab: React.FC<{ onMajlis: () => void }> = ({ onMajlis }) => {
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');

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
            محادثة
          </button>
          <button
            onClick={() => setMode('voice')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-arabic transition-all',
              mode === 'voice' ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Mic className="w-4 h-4" />
            صوتي
          </button>
        </div>

        {mode === 'voice' && (
          <Button
            onClick={onMajlis}
            size="sm"
            className="bg-gradient-to-r from-jood-gold-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white gap-2 font-arabic shadow-luxury h-9 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            المجلس الكامل
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
              <ChatInterface />
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
              <VoicePanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Lazy tab skeleton ────────────────────────────────────────────────────────
const TabSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-8 bg-muted/50 rounded-xl w-1/3" />
    <div className="h-32 bg-muted/30 rounded-2xl" />
    <div className="h-24 bg-muted/20 rounded-2xl" />
  </div>
);

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
const MobileBottomNav: React.FC<{ activeTab: string; onTabChange: (t: string) => void }> = ({ activeTab, onTabChange }) => (
  <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/40 safe-area-pb">
    <div className="flex items-center justify-around px-1 py-1">
      {NAV.map(({ value, label, icon: Icon }) => {
        const active = activeTab === value;
        return (
          <button
            key={value}
            onClick={() => onTabChange(value)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px]',
              active ? 'text-jood-teal-700' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('w-5 h-5', active && 'text-jood-teal-700')} />
            <span className={cn(
              'text-[9px] font-arabic leading-none',
              active ? 'text-jood-teal-700 font-semibold' : 'text-muted-foreground',
            )}>
              {label}
            </span>
            {active && (
              <span className="w-1 h-1 rounded-full bg-jood-teal-600 mt-0.5" />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const { hijri, prayer } = useSaudiSignal();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('jood.onboarding.done') !== '1';
  });
  const [majlisOpen, setMajlisOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">

      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto px-3 py-2 max-w-screen-2xl flex items-center gap-3">

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center shadow-elegant">
              <Sparkles className="w-4 h-4 text-jood-gold-300" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground font-arabic leading-none">جود AI</h1>
              <p className="hidden sm:block text-[10px] text-muted-foreground leading-none mt-0.5">مساعدتك الشخصية الذكية</p>
            </div>
          </div>

          {/* Saudi Signal Strip */}
          <div className="hidden md:flex items-center gap-3 mx-auto">
            {hijri && (
              <span className="signal-chip font-arabic text-[11px]">🌙 {hijri}</span>
            )}
            {prayer && (
              <span className="signal-chip font-arabic text-[11px]">🕌 {prayer.name} {prayer.time}</span>
            )}
            <span className="signal-chip text-[11px] font-mono">SAR/USD 3.75</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 mr-auto">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
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
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-jood-gold-500 ring-2 ring-background" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMajlisOpen(true)}
              className="h-8 gap-1.5 text-jood-gold-600 hover:text-jood-gold-700 hover:bg-jood-gold-500/10 border border-jood-gold-300/40 rounded-full px-3"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-arabic font-bold">المجلس</span>
              <Sparkles className="w-3 h-3 text-jood-gold-500" />
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs font-arabic">تصدير</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-arabic">تصدير البيانات</DialogTitle>
                </DialogHeader>
                <Suspense fallback={<TabSkeleton />}>
                  <ExportPanel />
                </Suspense>
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="text-xs hidden sm:inline">{user?.email?.split('@')[0]}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 text-muted-foreground hover:text-destructive gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-arabic">خروج</span>
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
            <Fade><HomeOverview onNavigate={setActiveTab} /></Fade>
          </TabsContent>

          {/* ── Chat + Voice ──────────────────────────────────────────────── */}
          <TabsContent value="chat" className="flex-1 p-4 mt-0">
            <ChatVoiceTab onMajlis={() => setMajlisOpen(true)} />
          </TabsContent>

          {/* ── Finance ──────────────────────────────────────────────────── */}
          <TabsContent value="financial" className="p-4 mt-0">
            <Suspense fallback={<TabSkeleton />}>
              <Fade><FinancialDashboard /></Fade>
            </Suspense>
          </TabsContent>

          {/* ── Planning (Calendar + Tasks + Habits) ─────────────────────── */}
          <TabsContent value="planning" className="p-4 mt-0">
            <Suspense fallback={<TabSkeleton />}>
              <Fade>
                <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">تخطيطي</h2>
                <PlanningHub />
              </Fade>
            </Suspense>
          </TabsContent>

          {/* ── Mood ─────────────────────────────────────────────────────── */}
          <TabsContent value="mood" className="p-4 mt-0">
            <Suspense fallback={<TabSkeleton />}>
              <Fade>
                <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">تتبع المزاج والصحة</h2>
                <MoodTracker />
              </Fade>
            </Suspense>
          </TabsContent>

          {/* ── Settings (Insights + Memory + Security) ───────────────────── */}
          <TabsContent value="settings" className="p-4 mt-0">
            <Suspense fallback={<TabSkeleton />}>
              <Fade>
                <h2 className="text-xl font-bold font-arabic mb-4 text-foreground">الإعدادات والذكاء</h2>
                <SettingsHub onNavigate={setActiveTab} />
              </Fade>
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────────────────── */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Majlis overlay ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {majlisOpen && <MajlisMode onClose={() => setMajlisOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
