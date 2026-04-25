import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Brain, User, Heart, Target, Activity, Users, MapPin,
  Trash2, Eye, EyeOff, Plus, Sparkles, AlertTriangle, Search,
} from 'lucide-react';
import { useMemories, type UserMemory, type MemoryKind } from '@/hooks/useMemories';
import { cn } from '@/lib/utils';

// ─── Kind metadata ─────────────────────────────────────────────────────────
const KINDS: Array<{
  value: MemoryKind | 'all';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'all',          label: 'الكل',        icon: Brain,    color: 'text-jood-gold-600'     },
  { value: 'fact',         label: 'حقائق',       icon: User,     color: 'text-blue-600'           },
  { value: 'preference',   label: 'تفضيلات',     icon: Heart,    color: 'text-rose-600'           },
  { value: 'goal',         label: 'أهداف',       icon: Target,   color: 'text-emerald-600'        },
  { value: 'pattern',      label: 'أنماط',       icon: Activity, color: 'text-amber-600'          },
  { value: 'relationship', label: 'علاقات',      icon: Users,    color: 'text-purple-600'         },
  { value: 'context',      label: 'سياق',        icon: MapPin,   color: 'text-jood-teal-700'      },
];

const KIND_META = Object.fromEntries(
  KINDS.filter(k => k.value !== 'all').map(k => [k.value, k]),
) as Record<MemoryKind, typeof KINDS[number]>;

// ═══════════════════════════════════════════════════════════════════════════
const MemoryCenter: React.FC = () => {
  const { memories, loading, remove, toggle, add, clearAll } = useMemories();
  const [filter, setFilter]       = useState<MemoryKind | 'all'>('all');
  const [search, setSearch]       = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [newKind, setNewKind]     = useState<MemoryKind>('fact');
  const [newContent, setNewContent] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = memories;
    if (filter !== 'all') out = out.filter(m => m.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(m => m.content.toLowerCase().includes(q));
    }
    return out;
  }, [memories, filter, search]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: memories.length };
    for (const m of memories) acc[m.kind] = (acc[m.kind] ?? 0) + 1;
    return acc;
  }, [memories]);

  // ── Add new memory ─────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await add(newKind, newContent.trim());
    setNewContent('');
    setShowAdd(false);
  };

  // ───────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold font-arabic text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-jood-gold-600" />
            ذاكرة جود
          </h2>
          <p className="text-sm text-muted-foreground font-arabic mt-1">
            ما تتذكره جود عنكِ — يمكنكِ تعديل أو حذف أيّ ذاكرة في أيّ وقت
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(s => !s)}
            className="gap-1.5 font-arabic"
          >
            <Plus className="w-3.5 h-3.5" />
            ذاكرة جديدة
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={memories.length === 0}
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 font-arabic"
          >
            <Trash2 className="w-3.5 h-3.5" />
            مسح الكل
          </Button>
        </div>
      </div>

      {/* ── Privacy notice ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-jood-teal-700/5 border border-jood-teal-700/20 rounded-xl p-3">
        <Sparkles className="w-4 h-4 text-jood-gold-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground font-arabic leading-relaxed">
          جود تتعلم منكِ تلقائياً عبر المحادثات لتقديم نصائح أدق وأكثر شخصية.
          كل الذاكرة محفوظة بشكل آمن، تخصكِ وحدكِ، ويمكنكِ حذفها أو إيقافها كلياً.
        </p>
      </div>

      {/* ── Add form ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 space-y-3 border-jood-gold-300/40 bg-jood-gold-500/5">
              <div className="flex flex-wrap gap-1.5">
                {KINDS.filter(k => k.value !== 'all').map(k => (
                  <button
                    key={k.value}
                    onClick={() => setNewKind(k.value as MemoryKind)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-arabic border transition',
                      newKind === k.value
                        ? 'bg-jood-gold-500 border-jood-gold-500 text-white'
                        : 'border-border text-muted-foreground hover:border-jood-gold-300',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <Input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="مثلاً: أفضّل الاستثمارات الحلال فقط"
                className="font-arabic text-right"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="font-arabic">
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newContent.trim()}
                  className="bg-jood-gold-500 hover:bg-jood-gold-600 text-white font-arabic"
                >
                  حفظ
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters + search ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {KINDS.map(k => {
            const Icon = k.icon;
            const count = counts[k.value] ?? 0;
            const active = filter === k.value;
            return (
              <button
                key={k.value}
                onClick={() => setFilter(k.value as any)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic border transition',
                  active
                    ? 'bg-jood-teal-700 border-jood-teal-700 text-white shadow-sm'
                    : 'border-border text-muted-foreground hover:border-jood-gold-300 hover:text-foreground',
                )}
              >
                <Icon className={cn('w-3 h-3', !active && k.color)} />
                {k.label}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full text-[10px] px-1.5 py-0',
                    active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الذاكرة…"
            className="pr-9 font-arabic text-right text-sm"
          />
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12 font-arabic text-sm">
          جار التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Brain className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-arabic text-muted-foreground text-sm">
            {memories.length === 0
              ? 'لا توجد ذكريات بعد. تحدثي مع جود وستبدأ في التعلم منكِ تلقائياً.'
              : 'لا توجد نتائج تطابق البحث.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {filtered.map(m => (
              <MemoryCard
                key={m.id}
                memory={m}
                onRemove={() => remove(m.id)}
                onToggle={() => toggle(m.id, !m.active)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Confirm clear-all dialog ────────────────────────────────────── */}
      <AnimatePresence>
        {confirmClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmClear(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="p-5 max-w-sm w-full">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                  <div>
                    <h3 className="font-arabic font-bold text-base">مسح كل الذاكرة؟</h3>
                    <p className="font-arabic text-xs text-muted-foreground mt-1">
                      هذا الإجراء غير قابل للتراجع. ستفقد جود كل ما تعرفه عنكِ.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)} className="font-arabic">
                    إلغاء
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => { await clearAll(); setConfirmClear(false); }}
                    className="font-arabic"
                  >
                    مسح الكل
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Memory card ────────────────────────────────────────────────────────────
const MemoryCard: React.FC<{
  memory: UserMemory;
  onRemove: () => void;
  onToggle: () => void;
}> = ({ memory, onRemove, onToggle }) => {
  const meta = KIND_META[memory.kind];
  const Icon = meta?.icon ?? Brain;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: memory.active ? 1 : 0.55, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={cn(
        'p-4 hover:shadow-md transition-shadow',
        !memory.active && 'border-dashed',
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            'bg-muted',
          )}>
            <Icon className={cn('w-4 h-4', meta?.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-[10px] font-arabic">
                {meta?.label ?? memory.kind}
              </Badge>
              {memory.importance >= 0.8 && (
                <Badge className="text-[10px] bg-jood-gold-500/15 text-jood-gold-700 border-jood-gold-300/30 font-arabic">
                  مهم
                </Badge>
              )}
              {memory.use_count > 0 && (
                <span className="text-[10px] text-muted-foreground font-arabic">
                  استُخدم {memory.use_count}×
                </span>
              )}
            </div>
            <p className="text-sm font-arabic leading-relaxed text-foreground">
              {memory.content}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title={memory.active ? 'إيقاف' : 'تفعيل'}
            >
              {memory.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default MemoryCenter;
