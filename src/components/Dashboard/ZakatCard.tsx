import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Moon, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';

interface ZakatResult {
  nisab_sar: number;
  total_qualifying_wealth_sar: number;
  above_nisab: boolean;
  sar_due: number;
  breakdown: Record<string, number>;
  gold_price_per_gram_sar: number;
}


export const ZakatCard: React.FC = () => {
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const ASSET_LABELS: Record<string, string> = {
    cash:        t('zakat.asset.cash'),
    gold:        t('zakat.asset.gold'),
    silver:      t('zakat.asset.silver'),
    stocks:      t('zakat.asset.stocks'),
    crypto:      t('zakat.asset.crypto'),
    receivables: t('zakat.asset.receivables'),
    business:    t('zakat.asset.business'),
    other:       t('zakat.asset.other'),
  };
  const [result, setResult] = useState<ZakatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hawlStart, setHawlStart] = useState(
    () => new Date(Date.now() - 354 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const fetch = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('zakat-calc', {
        body: { hawl_start_date: hawlStart },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data as ZakatResult);
    } catch (e: any) {
      setError(e.message || t('zakat.error.calc'));
    } finally {
      setLoading(false);
    }
  }, [session, hawlStart]);

  useEffect(() => { fetch(); }, [fetch]);

  const wealthPct = result
    ? Math.min(100, (result.total_qualifying_wealth_sar / result.nisab_sar) * 100)
    : 0;

  const breakdownEntries = result
    ? Object.entries(result.breakdown).filter(([, v]) => v > 0)
    : [];

  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  return (
    <Card className="jood-card overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-jood-gold-500/15 flex items-center justify-center">
              <Moon className="w-4 h-4 text-jood-gold-500" />
            </div>
            <div>
              <span className="font-arabic font-semibold">{t('zakat.title')}</span>
              <p className="text-[11px] text-muted-foreground font-normal font-arabic">
                {t('zakat.gold.price')}: {result ? fmt(result.gold_price_per_gram_sar) + t('zakat.per.gram') : '—'}
              </p>
            </div>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetch}
            disabled={loading}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-arabic">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-muted rounded-full w-3/4" />
            <div className="h-2.5 bg-muted rounded-full" />
            <div className="h-4 bg-muted rounded-full w-1/2" />
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Nisab comparison */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-arabic">
                  <span>{t('zakat.wealth')}</span>
                  <span>{t('zakat.nisab')}: {fmt(result.nisab_sar)}</span>
                </div>
                <div className="relative">
                  <Progress value={wealthPct} className="h-2.5" />
                  {result.above_nisab && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="absolute inset-0 h-2.5 rounded-full bg-gradient-to-r from-jood-gold-500 to-jood-gold-300 origin-left"
                      style={{ width: `${Math.min(wealthPct, 100)}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-foreground">
                    {fmt(result.total_qualifying_wealth_sar)}
                  </span>
                  <Badge className={
                    result.above_nisab
                      ? 'bg-jood-gold-500/15 text-jood-gold-500 border-jood-gold-500/30 font-arabic'
                      : 'bg-jood-ok/15 text-jood-ok border-jood-ok/30 font-arabic'
                  }>
                    {result.above_nisab ? t('zakat.above') : t('zakat.below')}
                  </Badge>
                </div>
              </div>

              {/* Zakat due */}
              <div className={`p-4 rounded-2xl border ${
                result.above_nisab
                  ? 'bg-jood-gold-500/8 border-jood-gold-500/25'
                  : 'bg-jood-ok/8 border-jood-ok/25'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-arabic mb-1">{t('zakat.due')}</p>
                    <p className={`text-2xl font-bold font-mono ${result.above_nisab ? 'text-jood-gold-500' : 'text-jood-ok'}`}>
                      {fmt(result.sar_due)}
                    </p>
                  </div>
                  {result.above_nisab ? (
                    <div className="w-10 h-10 rounded-full bg-jood-gold-500/15 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-jood-gold-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-jood-ok/15 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-jood-ok" />
                    </div>
                  )}
                </div>
                {!result.above_nisab && (
                  <p className="text-xs text-muted-foreground font-arabic mt-2">
                    {t('zakat.no.due')}
                  </p>
                )}
              </div>

              {/* Breakdown */}
              {breakdownEntries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('zakat.breakdown')}</p>
                  {breakdownEntries.map(([type, amount]) => (
                    <div key={type} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-jood-teal-500/60" />
                        <span className="text-sm font-arabic text-foreground">
                          {ASSET_LABELS[type] ?? type}
                        </span>
                      </div>
                      <span className="text-sm font-mono text-foreground">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Hawl info */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-arabic bg-muted/30 rounded-xl p-2.5">
                <Moon className="w-3.5 h-3.5 flex-shrink-0 text-jood-gold-300" />
                <span>{t('zakat.hawl')} {new Date(hawlStart).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
