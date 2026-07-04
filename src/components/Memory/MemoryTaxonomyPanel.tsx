import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Briefcase, Users, Wallet, HeartPulse, Moon,
  Clock, Target, Sparkles, Link2, MessageSquare, AlertCircle,
  Check, Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { useProfile } from '@/hooks/useDatabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Category icons and colors only — labels/hints are computed inside component via t()
const CATEGORY_META: Array<{
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { key: 'identity',      icon: User,          color: 'text-blue-600 bg-blue-500/10 border-blue-500/30' },
  { key: 'work',          icon: Briefcase,      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/30' },
  { key: 'family',        icon: Users,          color: 'text-rose-600 bg-rose-500/10 border-rose-500/30' },
  { key: 'financial',     icon: Wallet,         color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30' },
  { key: 'health',        icon: HeartPulse,     color: 'text-red-600 bg-red-500/10 border-red-500/30' },
  { key: 'religion',      icon: Moon,           color: 'text-jood-teal-700 bg-jood-teal-500/10 border-jood-teal-500/30' },
  { key: 'routine',       icon: Clock,          color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' },
  { key: 'goals',         icon: Target,         color: 'text-violet-600 bg-violet-500/10 border-violet-500/30' },
  { key: 'interests',     icon: Sparkles,       color: 'text-pink-600 bg-pink-500/10 border-pink-500/30' },
  { key: 'relationships', icon: Link2,          color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/30' },
  { key: 'preferences',   icon: MessageSquare,  color: 'text-jood-gold-700 bg-jood-gold-500/10 border-jood-gold-500/30' },
  { key: 'pain_points',   icon: AlertCircle,    color: 'text-orange-600 bg-orange-500/10 border-orange-500/30' },
];

interface TaxonomyRow {
  category: string;
  filled_count: number;
  template_id: string | null;
  latest_real_content: string | null;
  latest_importance: number | null;
}

const MemoryTaxonomyPanel: React.FC<{ onMemoryAdded?: () => void }> = ({ onMemoryAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const { profile } = useProfile();
  const [rows, setRows] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Build translated categories — use gender-specific hint if profile is loaded
  const genderSuffix = profile?.gender === 'female' ? 'f' : 'm';
  const CATEGORIES = CATEGORY_META.map(m => ({
    ...m,
    label: t(`tax.cat.${m.key}` as any),
    hint:  t(`tax.cat.${m.key}.hint.${genderSuffix}` as any),
  }));

  // ── Load taxonomy ──────────────────────────────────────────────────────────
  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_memory_taxonomy', { p_user_id: user.id });
    if (!error && Array.isArray(data)) setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // ── Save a new fact under a category ──────────────────────────────────────
  const saveFact = async (categoryKey: string) => {
    if (!user || !draft.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('user_memories').insert({
      user_id: user.id,
      kind: 'fact',
      category: categoryKey,
      content: draft.trim().slice(0, 400),
      importance: 0.7,
      confidence: 1.0,
      is_template: false,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: t('tax.save.error'), description: error.message, variant: 'destructive' });
      return;
    }
    setDraft('');
    setActiveCategory(null);
    await load();
    onMemoryAdded?.();
    toast({ title: t('tax.save.success'), description: t('tax.save.success.desc') });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground font-arabic">
        {t('tax.loading')}
      </div>
    );
  }

  const rowMap = Object.fromEntries(rows.map(r => [r.category, r]));
  const filledCount = rows.filter(r => r.filled_count > 0).length;
  const totalCount = CATEGORIES.length;
  const pct = Math.round((filledCount / totalCount) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-jood-teal-500/5 to-jood-gold-500/5 border border-border/30"
      dir={dir}
    >
      {/* Header + progress */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-arabic font-semibold text-sm">{t('tax.title')}</h3>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5">
            {t('tax.subtitle')}
          </p>
        </div>
        <div className="text-left">
          <div className="text-lg font-bold text-jood-teal-700">{filledCount}/{totalCount}</div>
          <div className="text-[10px] text-muted-foreground font-arabic">{pct}{t('tax.pct')}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-jood-teal-500 to-jood-gold-500"
        />
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CATEGORIES.map(cat => {
          const row = rowMap[cat.key];
          const filled = (row?.filled_count ?? 0) > 0;
          const isActive = activeCategory === cat.key;
          const Icon = cat.icon;

          return (
            <motion.div key={cat.key} layout>
              <button
                onClick={() => setActiveCategory(isActive ? null : cat.key)}
                className={cn(
                  'w-full flex flex-col items-start gap-1 p-2.5 rounded-xl border-2 text-right transition-all',
                  filled
                    ? `${cat.color} font-medium`
                    : 'bg-muted/20 border-dashed border-border/40 text-muted-foreground hover:border-border/70',
                  isActive && 'ring-2 ring-jood-teal-500/40',
                )}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {filled && <Check className="w-3 h-3 text-emerald-600" />}
                </div>
                <span className="text-[11px] font-arabic font-medium leading-tight">{cat.label}</span>
                {row?.latest_real_content ? (
                  <span className="text-[9px] opacity-75 font-arabic line-clamp-1 leading-tight">
                    {row.latest_real_content}
                  </span>
                ) : (
                  <span className="text-[9px] opacity-60 font-arabic line-clamp-1 leading-tight">
                    {cat.hint}
                  </span>
                )}
              </button>

              {/* Inline add field */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1.5 space-y-1.5 p-2 rounded-lg bg-card border border-border/40"
                >
                  <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={cat.hint}
                    className="text-xs font-arabic h-8"
                    onKeyDown={e => { if (e.key === 'Enter') saveFact(cat.key); }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => saveFact(cat.key)}
                      disabled={saving || !draft.trim()}
                      className="h-7 px-2 text-[10px] font-arabic gap-1 bg-jood-teal-500 hover:bg-jood-teal-600 text-white flex-1"
                    >
                      <Plus className="w-3 h-3" />
                      {saving ? t('tax.saving') : t('tax.add')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setActiveCategory(null); setDraft(''); }}
                      className="h-7 px-2 text-[10px] font-arabic"
                    >
                      {t('tax.cancel')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Tip */}
      {filledCount < totalCount && (
        <p className="text-[10px] text-muted-foreground font-arabic text-center pt-1 border-t border-border/20">
          {t('tax.tip')}
        </p>
      )}
    </motion.div>
  );
};

export default MemoryTaxonomyPanel;
