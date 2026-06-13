import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Volume2, RefreshCw, X, Share2,
  Bell, Wallet, BookHeart, Calendar, Lightbulb, Loader2,
  ThumbsUp, CloudSun,
} from 'lucide-react';
import { useDailyBrief, type BriefHighlight } from '@/hooks/useDailyBrief';
import { useChat } from '@/hooks/useChat';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  prayer:  Bell,
  finance: Wallet,
  memory:  BookHeart,
  event:   Calendar,
  tip:     Lightbulb,
};

interface Props { onActionClick?: () => void; }

export const MorningBrief: React.FC<Props> = ({ onActionClick }) => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const { brief, loading, error, generate, markRead, markSpoken, dismiss } = useDailyBrief(lang);
  const { speakMessage, speaking, stopSpeaking } = useChat();
  const [weather, setWeather] = useState<string | null>(null);

  // Mark as read
  useEffect(() => {
    if (brief && !brief.read_at) {
      const tid = setTimeout(() => markRead(), 1500);
      return () => clearTimeout(tid);
    }
  }, [brief, markRead]);

  // Fetch Riyadh temperature (lightweight)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=24.69&longitude=46.72&current=temperature_2m&wind_speed_unit=ms')
      .then(r => r.json())
      .then(d => {
        const t = d?.current?.temperature_2m;
        if (t !== undefined) setWeather(`${Math.round(t)}°C`);
      })
      .catch(() => {});
  }, []);

  // ── Voice: read brief with Jood voice ───────────────────────────────────────
  const handleListen = async () => {
    if (speaking) { stopSpeaking(); return; }
    if (!brief) return;
    markSpoken();
    // Always read in Arabic (primary Jood voice language)
    const text = [
      brief.greeting,
      brief.content,
      brief.suggested_action,
      lang === 'ar'
        ? 'لأي تعديل أو إضافة، كلّميني.'
        : 'For any adjustments or additions, just ask me.',
    ].filter(Boolean).join('. ');
    await speakMessage(text, 'warm', false);
  };

  // ── Share: WhatsApp or native share ─────────────────────────────────────────
  const handleShare = async () => {
    if (!brief) return;
    const meta = (brief as any).meta ?? {};
    const greetingEn = meta.greeting_en ?? brief.greeting;
    const contentEn  = meta.content_en  ?? brief.content;
    const actionEn   = meta.action_en   ?? brief.suggested_action ?? '';

    const text = [
      `📋 *JOOD AI Daily Brief*`,
      ``,
      `*${brief.greeting}*`,
      brief.content,
      brief.suggested_action ? `→ ${brief.suggested_action}` : '',
      ``,
      `*${greetingEn}*`,
      contentEn,
      actionEn ? `→ ${actionEn}` : '',
      ``,
      `— JOOD AI`,
    ].filter(l => l !== undefined).join('\n');

    // Try WhatsApp deep link (works on mobile)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'JOOD AI Daily Brief', text });
        return;
      } catch { /* user cancelled or not supported, fall through */ }
    }
    // Fallback: open WhatsApp web
    window.open(waUrl, '_blank', 'noopener');
    toast({ title: lang === 'ar' ? 'تم فتح واتساب' : 'Opening WhatsApp', description: lang === 'ar' ? 'شارك موجزك اليومي' : 'Share your daily brief' });
  };

  if (loading && !brief) {
    return (
      <Card className="p-5 bg-gradient-to-br from-jood-teal-900 via-jood-teal-800 to-jood-teal-900 border-jood-gold-500/30">
        <div className="flex items-center gap-2 text-jood-gold-300/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-arabic">{lang === 'ar' ? 'جود تُعِدّ موجزك…' : 'Jood is preparing your brief…'}</span>
        </div>
      </Card>
    );
  }

  if ((error && !brief) || !brief) return null;

  const meta       = (brief as any).meta ?? {};
  const greetingEn = meta.greeting_en ?? '';
  const contentEn  = meta.content_en  ?? '';
  const actionEn   = meta.action_en   ?? '';
  const prayerAr   = meta.prayer_ar   ?? '';
  const prayerEn   = meta.prayer_en   ?? '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-jood-teal-900 via-jood-teal-800 to-jood-teal-900 border-jood-gold-500/30 shadow-luxury">

          {/* Subtle ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-jood-gold-400/40 to-transparent" />
          </div>

          <div className="relative z-10 p-5 md:p-6 space-y-4">

            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-jood-gold-400" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-jood-gold-400 uppercase font-arabic">
                  {lang === 'ar' ? 'موجز جود' : 'JOOD Brief'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {weather && (
                  <div className="flex items-center gap-1 text-white/50 text-xs mr-2">
                    <CloudSun className="w-3.5 h-3.5" />
                    <span>{weather}</span>
                  </div>
                )}
                <button
                  onClick={() => generate(true)}
                  disabled={loading}
                  className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </button>
                <button
                  onClick={dismiss}
                  className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Bilingual greeting ───────────────────────────────────── */}
            <div className="space-y-0.5">
              <h2 className="text-xl md:text-2xl font-bold text-white leading-snug font-arabic" dir="rtl">
                {brief.greeting}
              </h2>
              {greetingEn && (
                <p className="text-sm text-white/50 font-medium tracking-wide">
                  {greetingEn}
                </p>
              )}
            </div>

            {/* ── Highlights pills ─────────────────────────────────────── */}
            {brief.highlights && brief.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prayerAr && (
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-white/10 border border-white/15 text-white text-xs font-arabic">
                    <Bell className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    {prayerAr}
                  </div>
                )}
                {brief.highlights.slice(0, 3).map((h: BriefHighlight & { text_ar?: string; text_en?: string }, i: number) => {
                  const Icon = ICON[h.kind] ?? Lightbulb;
                  const label = (h as any).text_ar ?? h.text ?? '';
                  return (
                    <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-white/10 border border-white/15 text-white text-xs font-arabic">
                      <Icon className="w-3 h-3 text-jood-gold-400 flex-shrink-0" />
                      {label}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bilingual content ────────────────────────────────────── */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-sm text-white/90 leading-relaxed font-arabic" dir="rtl">
                {brief.content}
              </p>
              {contentEn && (
                <p className="text-xs text-white/50 leading-relaxed">
                  {contentEn}
                </p>
              )}
            </div>

            {/* ── Closing CTA ──────────────────────────────────────────── */}
            <div className="border-t border-white/10 pt-3 space-y-0.5">
              <p className="text-xs text-jood-gold-300/80 font-arabic" dir="rtl">
                {brief.suggested_action
                  ? `← ${brief.suggested_action}`
                  : 'لأي تعديل أو إضافة، كلّم جود ←'}
              </p>
              {(actionEn || brief.suggested_action) && (
                <p className="text-[11px] text-white/35">
                  {actionEn || 'Ask Jood for any adjustments or additions.'}
                </p>
              )}
            </div>

            {/* ── Action buttons ───────────────────────────────────────── */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleListen}
                disabled={loading}
                size="sm"
                className={cn(
                  'gap-1.5 font-arabic text-xs',
                  'bg-jood-gold-500/90 hover:bg-jood-gold-400 text-jood-teal-900 font-bold shadow-md',
                  'flex-1',
                )}
              >
                <Volume2 className={cn('w-3.5 h-3.5', speaking && 'animate-pulse')} />
                {speaking
                  ? (lang === 'ar' ? 'إيقاف' : 'Stop')
                  : (lang === 'ar' ? 'استمع لجود' : 'Listen to Jood')}
              </Button>

              <Button
                onClick={handleShare}
                size="sm"
                className="gap-1.5 font-arabic text-xs bg-jood-gold-500/90 hover:bg-jood-gold-400 text-jood-teal-900 font-bold shadow-md flex-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'شارك اليوم' : 'Share Brief'}
              </Button>

              {brief.suggested_action && onActionClick && (
                <button
                  onClick={onActionClick}
                  className="p-2 rounded-md text-jood-gold-300 hover:text-jood-gold-200 hover:bg-white/10 transition"
                  title={lang === 'ar' ? 'كلّم جود' : 'Ask Jood'}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningBrief;
