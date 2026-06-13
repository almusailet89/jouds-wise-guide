import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const MoodTracker = lazy(() => import('@/components/Mood/MoodTracker'));
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, TrendingUp, Heart, Target, Moon, X, Check,
  ChevronRight, Brain, Loader2, RefreshCcw, SmilePlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recommendation {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_target: string | null;
  confidence: number | null;
  priority: number;
  dismissed_at: string | null;
  acted_at: string | null;
  created_at: string;
}

// ─── Kind config ──────────────────────────────────────────────────────────────
const KINDS = [
  { value: 'all',       label: 'الكل',      icon: Sparkles,  color: 'text-jood-gold-500' },
  { value: 'finance',   label: 'مالية',     icon: TrendingUp, color: 'text-jood-teal-700' },
  { value: 'health',    label: 'صحة',       icon: Heart,     color: 'text-rose-500' },
  { value: 'planning',  label: 'تخطيط',     icon: Target,    color: 'text-indigo-600' },
  { value: 'spiritual', label: 'روحية',     icon: Moon,      color: 'text-emerald-600' },
  { value: 'mood',      label: 'المزاج',    icon: SmilePlus, color: 'text-amber-500' },
] as const;

const kindConfig = (v: string) => KINDS.find(k => k.value === v) ?? KINDS[0];

// ─── Confidence pill color ────────────────────────────────────────────────────
const confColor = (c: number | null) => {
  if (!c) return 'bg-muted text-muted-foreground';
  if (c >= 0.85) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (c >= 0.65) return 'bg-jood-gold-100 text-jood-gold-800 dark:bg-jood-gold-900/20 dark:text-jood-gold-300';
  return 'bg-muted text-muted-foreground';
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface AIRecommendationsProps {
  onNavigate?: (tab: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [items, setItems] = useState<Recommendation[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ai_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data as Recommendation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return items.filter(r => {
      if (!showDismissed && r.dismissed_at) return false;
      if (filter !== 'all' && r.kind !== filter) return false;
      return true;
    });
  }, [items, filter, showDismissed]);

  // ── Counts per kind ──────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const active = items.filter(i => !i.dismissed_at);
    return {
      all: active.length,
      finance: active.filter(i => i.kind === 'finance').length,
      health: active.filter(i => i.kind === 'health').length,
      planning: active.filter(i => i.kind === 'planning').length,
      spiritual: active.filter(i => i.kind === 'spiritual').length,
      mood: active.filter(i => i.kind === 'mood').length,
    };
  }, [items]);

  // ── Dismiss / Act ────────────────────────────────────────────────────────────
  const dismiss = async (id: string) => {
    setItems(prev => prev.map(r => r.id === id ? { ...r, dismissed_at: new Date().toISOString() } : r));
    await (supabase as any).from('ai_recommendations')
      .update({ dismissed_at: new Date().toISOString() }).eq('id', id);
  };

  const act = async (rec: Recommendation) => {
    await (supabase as any).from('ai_recommendations')
      .update({ acted_at: new Date().toISOString() }).eq('id', rec.id);
    setItems(prev => prev.map(r => r.id === rec.id ? { ...r, acted_at: new Date().toISOString() } : r));
    if (rec.cta_target && onNavigate) onNavigate(rec.cta_target);
    toast({ title: t('rec.toast.acting'), description: rec.title });
  };

  const restore = async (id: string) => {
    setItems(prev => prev.map(r => r.id === id ? { ...r, dismissed_at: null } : r));
    await (supabase as any).from('ai_recommendations')
      .update({ dismissed_at: null }).eq('id', id);
  };

  // ── Generate via dedicated edge function ────────────────────────────────────
  const generate = async (silent = false) => {
    if (!user) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-recommendations');
      if (error) throw error;
      await load();
      if (!silent) toast({ title: t('rec.toast.generated'), description: t('rec.toast.generated.desc') });
    } catch (err) {
      if (!silent) toast({ title: t('rec.toast.failed'), description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Auto-refresh: generate on first load or if newest rec is > 7 days old ──
  useEffect(() => {
    if (!user || loading) return;
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const newest = items[0]?.created_at ? new Date(items[0].created_at).getTime() : 0;
    if (Date.now() - newest > WEEK_MS) {
      generate(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-jood-gold-500" />
            <h2 className="text-xl font-bold font-arabic">{t('rec.title')}</h2>
          </div>
          <p className="text-xs text-muted-foreground font-arabic">
            {t('rec.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setShowDismissed(v => !v)}
            className="font-arabic text-xs"
          >
            {t(showDismissed ? 'rec.hide.dismissed' : 'rec.show.dismissed')}
          </Button>
          <Button
            onClick={generate} disabled={generating} size="sm"
            className="bg-gradient-to-r from-jood-teal-900 to-jood-teal-700 text-white gap-1.5 font-arabic"
          >
            {generating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCcw className="w-3.5 h-3.5" />
            }
            {t('rec.generate')}
          </Button>
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-card/60 border border-border/40 p-1 gap-0.5 h-auto">
          {KINDS.map(k => {
            const Icon = k.icon;
            const n = counts[k.value as keyof typeof counts] ?? 0;
            return (
              <TabsTrigger
                key={k.value}
                value={k.value}
                className="gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic data-[state=active]:bg-jood-teal-900 data-[state=active]:text-white"
              >
                <Icon className="w-3.5 h-3.5" />
                {t('rec.cat.' + k.value)}
                {n > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">
                    {n}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {filter === 'mood' ? (
        <Suspense fallback={
          <div className="text-center py-12 text-muted-foreground text-xs font-arabic">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          </div>
        }>
          <MoodTracker />
        </Suspense>
      ) : loading ? (
        <div className="text-center py-12 text-muted-foreground text-xs font-arabic">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          {t('rec.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-arabic text-muted-foreground mb-3">{t('rec.empty')}</p>
            <Button onClick={generate} size="sm" variant="outline" className="font-arabic">
              <RefreshCcw className="w-3.5 h-3.5 ml-1" /> {t('rec.empty.btn')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {filtered.map((r, i) => {
              const K = kindConfig(r.kind);
              const Icon = K.icon;
              const dismissed = !!r.dismissed_at;
              const acted = !!r.acted_at;

              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: dismissed ? 0.5 : 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className={cn(
                    'h-full transition-shadow hover:shadow-elegant',
                    acted && 'ring-2 ring-emerald-500/40',
                    dismissed && 'opacity-60',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center',
                            'bg-gradient-to-br from-muted/60 to-muted/20',
                          )}>
                            <Icon className={cn('w-4 h-4', K.color)} />
                          </div>
                          <Badge variant="outline" className="font-arabic text-[10px]">
                            {t(('rec.cat.' + K.value) as string)}
                          </Badge>
                          {r.confidence != null && (
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-mono',
                              confColor(r.confidence),
                            )}>
                              {Math.round(r.confidence * 100)}%
                            </span>
                          )}
                          {acted && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-arabic gap-0.5">
                              <Check className="w-2.5 h-2.5" /> {t('rec.acted')}
                            </Badge>
                          )}
                        </div>
                        {!dismissed && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => dismiss(r.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      <h3 className="font-bold text-sm font-arabic text-foreground mb-1">
                        {r.title}
                      </h3>
                      {r.body && (
                        <p className="text-xs text-muted-foreground font-arabic leading-relaxed mb-3 line-clamp-3">
                          {r.body}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        {r.cta_label ? (
                          <Button
                            onClick={() => act(r)}
                            size="sm"
                            disabled={acted}
                            className="flex-1 h-8 text-xs font-arabic bg-jood-teal-900 hover:bg-jood-teal-700 text-white gap-1"
                          >
                            {r.cta_label}
                            <ChevronRight className="w-3 h-3 rotate-180" />
                          </Button>
                        ) : <div />}
                        {dismissed && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => restore(r.id)}
                            className="h-8 text-[11px] font-arabic text-jood-teal-700"
                          >
                            {t('rec.restore')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AIRecommendations;
