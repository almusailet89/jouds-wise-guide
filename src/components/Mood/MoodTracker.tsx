import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, TrendingUp, Calendar, BarChart3, Loader2 } from "lucide-react";
import { useMoodLogs } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';

// mood_score 1-5 mapped to Arabic + emoji
const MOOD_OPTIONS = [
  { score: 5, ar: 'ممتاز', emoji: '😊', color: 'bg-green-100 text-green-800 border-green-200', label: 'Great' },
  { score: 4, ar: 'جيد',    emoji: '🙂', color: 'bg-teal-100 text-teal-800 border-teal-200',   label: 'Good' },
  { score: 3, ar: 'عادي',   emoji: '😐', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Okay' },
  { score: 2, ar: 'منهك',   emoji: '😕', color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Low' },
  { score: 1, ar: 'متوتر',  emoji: '😰', color: 'bg-red-100 text-red-800 border-red-200', label: 'Stressed' },
];

const scoreToOption = (score: number) =>
  MOOD_OPTIONS.find(o => o.score === score) ?? MOOD_OPTIONS[2];

const MoodTracker: React.FC = () => {
  const { moodLogs, loading, addMoodLog } = useMoodLogs();
  const { t, lang } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleLog = async (score: number) => {
    if (saving) return;
    setSelected(score);
    setSaving(true);
    const opt = scoreToOption(score);
    await addMoodLog({ mood_score: score, mood_label: opt.label, note: null });
    setSaving(false);
  };

  // Stats derived from DB logs
  const last7 = moodLogs.filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000));
  const avgScore = last7.length
    ? (last7.reduce((s, l) => s + l.mood_score, 0) / last7.length).toFixed(1)
    : '—';
  const dominant = last7.length
    ? scoreToOption(Math.round(last7.reduce((s, l) => s + l.mood_score, 0) / last7.length))
    : null;

  // Streak: consecutive days (today backward) where mood_score >= 4
  const streak = (() => {
    let count = 0;
    const sorted = [...moodLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const log of sorted) {
      if (log.mood_score >= 4) count++;
      else break;
    }
    return count;
  })();

  return (
    <div className="space-y-5">
      {/* Mood selection card */}
      <Card className="jood-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-arabic">
            <Heart className="h-5 w-5 text-jood-teal-500" />
            {t('mood.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {MOOD_OPTIONS.map(({ score, ar, label, emoji, color }) => (
              <Button
                key={score}
                variant="outline"
                disabled={saving}
                onClick={() => handleLog(score)}
                className={`h-20 flex-col gap-1.5 transition-all duration-200 ${
                  selected === score ? color + ' scale-105 shadow-card' : 'hover:scale-102'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs font-arabic">{lang === 'ar' ? ar : label}</span>
              </Button>
            ))}
          </div>

          <AnimatePresence>
            {selected !== null && !saving && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 rounded-xl bg-jood-teal-500/10 border border-jood-teal-500/20"
              >
                <p className="text-sm font-arabic text-jood-teal-700">
                  ✨ {t('mood.logged')}
                </p>
              </motion.div>
            )}
            {saving && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-jood-teal-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{last7.length}</p>
                <p className="text-xs text-muted-foreground font-arabic mt-0.5">{t('mood.logs.week')}</p>
              </div>
              <Calendar className="h-7 w-7 text-jood-teal-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{avgScore}</p>
                <p className="text-xs text-muted-foreground font-arabic mt-0.5">{t('mood.avg')}</p>
              </div>
              <BarChart3 className="h-7 w-7 text-jood-teal-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{streak}</p>
                <p className="text-xs text-muted-foreground font-arabic mt-0.5">{t('mood.streak')}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-jood-gold-500/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood history */}
      <Card className="jood-card">
        <CardHeader>
          <CardTitle className="text-base font-arabic">{t('mood.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-jood-teal-500" />
            </div>
          ) : moodLogs.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm font-arabic py-6">
              {t('mood.no.logs')}
            </p>
          ) : (
            <div className="space-y-2">
              {moodLogs.slice(0, 10).map(log => {
                const opt = scoreToOption(log.mood_score);
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <span className="text-xl">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={opt.color + ' text-xs'}>
                          {lang === 'ar' ? opt.ar : opt.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-arabic truncate">{log.note}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= log.mood_score ? 'bg-jood-teal-500' : 'bg-muted'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights (static, contextual) */}
      <Card className="jood-card">
        <CardHeader>
          <CardTitle className="text-base font-arabic">{t('mood.insights.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {dominant && (
            <div className="p-3 rounded-xl bg-jood-teal-500/8 border border-jood-teal-500/15">
              <p className="text-sm font-arabic text-foreground">
                🔍 <strong>{t('mood.pattern.label')}</strong> {t('mood.pattern.body')} &quot;{lang === 'ar' ? dominant.ar : dominant.label}&quot; {dominant.emoji}
              </p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-jood-gold-500/8 border border-jood-gold-500/15">
            <p className="text-sm font-arabic text-foreground">
              💡 <strong>{t('mood.tip.label')}</strong> {t('mood.tip.body')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
            <p className="text-sm font-arabic text-foreground">
              📊 <strong>{t('mood.trend.label')}</strong> {t('mood.trend.body')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MoodTracker;
