import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Volume2, RefreshCw, X, ArrowLeft,
  Bell, Wallet, BookHeart, Calendar, Lightbulb, Loader2,
} from 'lucide-react';
import { useDailyBrief, type BriefHighlight } from '@/hooks/useDailyBrief';
import { useChat } from '@/hooks/useChat';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

// ─── Highlight icon mapping ─────────────────────────────────────────────────
const HIGHLIGHT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  prayer:  Bell,
  finance: Wallet,
  memory:  BookHeart,
  event:   Calendar,
  tip:     Lightbulb,
};

const HIGHLIGHT_COLOR: Record<string, string> = {
  prayer:  'text-emerald-600 bg-emerald-500/10',
  finance: 'text-amber-600 bg-amber-500/10',
  memory:  'text-rose-600 bg-rose-500/10',
  event:   'text-blue-600 bg-blue-500/10',
  tip:     'text-jood-gold-600 bg-jood-gold-500/10',
};

// ═══════════════════════════════════════════════════════════════════════════
interface MorningBriefProps {
  onActionClick?: () => void; // open chat with the suggested action
}

export const MorningBrief: React.FC<MorningBriefProps> = ({ onActionClick }) => {
  const { t, dir, lang } = useLanguage();
  const { brief, loading, error, generate, markRead, markSpoken, dismiss } = useDailyBrief(lang);
  const { speakMessage, speaking } = useChat();

  // Mark as read when brief becomes visible
  useEffect(() => {
    if (brief && !brief.read_at) {
      const t = setTimeout(() => markRead(), 1500);
      return () => clearTimeout(t);
    }
  }, [brief, markRead]);

  // ── Listen handler — TTS the greeting + content (+ action) ──────────────
  const handleListen = async () => {
    if (!brief || speaking) return;
    const fullText = [
      brief.greeting,
      brief.content,
      brief.suggested_action ?? '',
    ].filter(Boolean).join('. ');
    markSpoken();
    await speakMessage(fullText, 'warm', false);
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading && !brief) {
    return (
      <Card className="p-6 bg-gradient-to-br from-jood-teal-700/5 via-card to-jood-gold-500/5 border-jood-gold-300/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-jood-gold-500" />
          <span className="font-arabic text-sm">{t('brief.loading')}</span>
        </div>
      </Card>
    );
  }

  // ── Error state (unobtrusive — feature degrades silently) ───────────────
  if (error && !brief) {
    return null;
  }

  if (!brief) return null;

  // ──────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        layout
      >
        <Card className={cn(
          'relative overflow-hidden p-5 md:p-6',
          'bg-gradient-to-br from-jood-teal-900 via-jood-teal-700 to-jood-teal-900',
          'border-jood-gold-500/30 shadow-luxury',
        )} dir={dir}>

          {/* Ambient particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-jood-gold-300"
                initial={{
                  x: Math.random() * 600,
                  y: Math.random() * 200,
                  opacity: 0,
                }}
                animate={{ y: [null, -40], opacity: [0, 0.7, 0] }}
                transition={{
                  duration: 5 + Math.random() * 3,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                }}
              />
            ))}
          </div>

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-jood-gold-300">
              <Sparkles className="w-4 h-4" />
              <span className="font-arabic text-xs font-bold tracking-wide">{t('brief.label')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => generate(true)}
                disabled={loading}
                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                title={t('brief.refresh.title')}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                title={t('brief.close')}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Greeting */}
          <div className="relative z-10 mb-3">
            <h2 className="font-arabic text-2xl md:text-3xl font-bold text-white leading-tight">
              {brief.greeting}
            </h2>
            {brief.meta?.hijri && (
              <p className="text-xs text-jood-gold-300/80 font-arabic mt-1">
                🌙 {brief.meta.hijri}
              </p>
            )}
          </div>

          {/* Content */}
          <p className="relative z-10 font-arabic text-sm md:text-base text-white/90 leading-relaxed mb-4">
            {brief.content}
          </p>

          {/* Highlights */}
          {brief.highlights && brief.highlights.length > 0 && (
            <div className="relative z-10 flex flex-wrap gap-2 mb-4">
              {brief.highlights.map((h: BriefHighlight, i: number) => {
                const Icon = HIGHLIGHT_ICON[h.kind] ?? Lightbulb;
                const colorCls = HIGHLIGHT_COLOR[h.kind] ?? 'text-jood-gold-600 bg-jood-gold-500/10';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-arabic',
                      'bg-white/10 backdrop-blur-sm border border-white/15 text-white',
                    )}
                  >
                    <span className={cn('w-5 h-5 rounded-full flex items-center justify-center', colorCls)}>
                      <Icon className="w-3 h-3" />
                    </span>
                    {h.text}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Action row */}
          <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
            {brief.suggested_action && (
              <button
                onClick={onActionClick}
                className="flex items-center gap-2 text-jood-gold-200 hover:text-jood-gold-100 font-arabic text-sm group transition"
              >
                <span>{brief.suggested_action}</span>
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              </button>
            )}

            <Button
              onClick={handleListen}
              disabled={speaking || loading}
              size="sm"
              className={cn(
                'mr-auto gap-1.5 font-arabic',
                'bg-jood-gold-500/90 hover:bg-jood-gold-400 text-jood-teal-900 font-bold',
                'shadow-md',
              )}
            >
              <Volume2 className={cn('w-3.5 h-3.5', speaking && 'animate-pulse')} />
              {speaking ? t('voice.speaking') : t('brief.listen')}
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningBrief;
