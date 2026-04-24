import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { VoicePanel } from '@/components/Voice/VoicePanel';
import { FinancialDashboard } from '@/components/Dashboard/FinancialDashboard';
import TasksPlanner from '@/components/Tasks/TasksPlanner';
import MoodTracker from '@/components/Mood/MoodTracker';
import HabitsTracker from '@/components/Habits/HabitsTracker';
import { ExportPanel } from '@/components/Export/ExportPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  MessageSquare, TrendingUp, Calendar, Heart, Brain,
  LogOut, User, Mic, Download, Sparkles, CheckSquare, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Saudi Signal Strip (top of page) ────────────────────────────────────────
const useSaudiSignal = () => {
  const [hijri, setHijri] = React.useState('');
  const [prayer, setPrayer] = React.useState<{ name: string; time: string } | null>(null);

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

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { value: 'chat',      label: 'جود AI',    icon: MessageSquare,  ar: true },
  { value: 'financial', label: 'المالية',   icon: TrendingUp,     ar: true },
  { value: 'tasks',     label: 'المهام',    icon: CheckSquare,    ar: true },
  { value: 'habits',    label: 'العادات',   icon: Star,           ar: true },
  { value: 'mood',      label: 'المزاج',    icon: Heart,          ar: true },
  { value: 'voice',     label: 'المجلس',    icon: Mic,            ar: true },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const { hijri, prayer } = useSaudiSignal();

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto px-4 py-3 max-w-screen-2xl flex items-center gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center shadow-elegant">
              <Sparkles className="w-4 h-4 text-jood-gold-300" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-arabic leading-none">جود AI</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">مساعدتك المالية الذكية</p>
            </div>
          </div>

          {/* Saudi Signal Strip */}
          <div className="hidden md:flex items-center gap-4 mx-auto">
            {hijri && (
              <span className="signal-chip font-arabic text-[11px]">
                🌙 {hijri}
              </span>
            )}
            {prayer && (
              <span className="signal-chip font-arabic text-[11px]">
                🕌 {prayer.name} {prayer.time}
              </span>
            )}
            <span className="signal-chip text-[11px] font-mono">SAR/USD 3.75</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 mr-auto">
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
                <ExportPanel />
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

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col max-w-screen-2xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">

          {/* Tab nav */}
          <div className="px-4 pt-4">
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

          {/* ── Chat (full height) ────────────────────────────────────────── */}
          <TabsContent value="chat" className="flex-1 p-4 mt-0">
            <div className="h-[calc(100vh-160px)]">
              <ChatInterface />
            </div>
          </TabsContent>

          {/* ── Finance ──────────────────────────────────────────────────── */}
          <TabsContent value="financial" className="p-4 mt-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <FinancialDashboard />
            </motion.div>
          </TabsContent>

          {/* ── Tasks ────────────────────────────────────────────────────── */}
          <TabsContent value="tasks" className="p-4 mt-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <h2 className="text-xl font-bold font-arabic mb-5 text-foreground">المهام والتخطيط</h2>
              <TasksPlanner />
            </motion.div>
          </TabsContent>

          {/* ── Habits ───────────────────────────────────────────────────── */}
          <TabsContent value="habits" className="p-4 mt-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <h2 className="text-xl font-bold font-arabic mb-5 text-foreground">عاداتي اليومية</h2>
              <HabitsTracker />
            </motion.div>
          </TabsContent>

          {/* ── Mood ─────────────────────────────────────────────────────── */}
          <TabsContent value="mood" className="p-4 mt-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <h2 className="text-xl font-bold font-arabic mb-5 text-foreground">تتبع المزاج والصحة</h2>
              <MoodTracker />
            </motion.div>
          </TabsContent>

          {/* ── Majlis (Voice) ────────────────────────────────────────────── */}
          <TabsContent value="voice" className="p-4 mt-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <h2 className="text-xl font-bold font-arabic mb-5 text-foreground">المجلس — التجربة الصوتية</h2>
              <VoicePanel onVoiceMessage={() => {}} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
