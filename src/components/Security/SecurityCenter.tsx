import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield, Fingerprint, Lock, EyeOff, ShieldCheck, Trash2,
  Database, Mic, TrendingUp, Heart, CheckSquare, Star,
  AlertTriangle, Download, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'jood.security.prefs';

interface Prefs {
  faceId: boolean;
  encryptLocal: boolean;
  zeroKnowledge: boolean;
  scopes: Record<string, boolean>;
}

// Scope keys — labels/descs are resolved via t() inside component
const SCOPE_KEYS = ['finance', 'mood', 'tasks', 'habits', 'voice', 'chat'] as const;
type ScopeKey = typeof SCOPE_KEYS[number];

const SCOPE_ICONS: Record<ScopeKey, React.ComponentType<{ className?: string }>> = {
  finance: TrendingUp,
  mood:    Heart,
  tasks:   CheckSquare,
  habits:  Star,
  voice:   Mic,
  chat:    Database,
};

const DEFAULTS: Prefs = {
  faceId: false,
  encryptLocal: true,
  zeroKnowledge: true,
  scopes: Object.fromEntries(SCOPE_KEYS.map(k => [k, true])),
};

// ═══════════════════════════════════════════════════════════════════════════════
export const SecurityCenter: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t, lang, dir } = useLanguage();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // The confirmation word is lang-specific
  const DELETE_WORD = t('sec.delete.confirm.word');

  // ── Load persisted prefs ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore malformed localStorage */ }
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────────────
  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleScope = (key: string) => {
    savePrefs({ ...prefs, scopes: { ...prefs.scopes, [key]: !prefs.scopes[key] } });
    toast({ title: t('sec.scope.saved'), description: t('sec.scope.saved.desc') });
  };

  // ── Face ID (WebAuthn platform authenticator) ──────────────────────────────
  const enableFaceId = async () => {
    try {
      if (!window.PublicKeyCredential) {
        toast({ title: t('sec.faceid.not.supported'), description: t('sec.faceid.not.supported.desc'), variant: 'destructive' });
        return;
      }
      const available = await (window.PublicKeyCredential as any)
        .isUserVerifyingPlatformAuthenticatorAvailable?.();
      if (!available) {
        toast({ title: t('sec.faceid.not.available'), description: t('sec.faceid.not.available.desc'), variant: 'destructive' });
        return;
      }

      await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Jood AI' },
          user: {
            id: new TextEncoder().encode(user?.id || 'anon'),
            name: user?.email || 'user',
            displayName: user?.email?.split('@')[0] || 'مستخدم',
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { userVerification: 'required' },
          timeout: 60000,
        },
      });

      savePrefs({ ...prefs, faceId: true });
      toast({ title: t('sec.faceid.success'), description: t('sec.faceid.success.desc') });
    } catch {
      toast({ title: t('sec.faceid.cancelled'), description: t('sec.faceid.cancelled.desc'), variant: 'destructive' });
    }
  };

  const disableFaceId = () => {
    savePrefs({ ...prefs, faceId: false });
    toast({ title: t('sec.faceid.disabled'), description: t('sec.faceid.disabled.desc') });
  };

  // ── Export all data ─────────────────────────────────────────────────────────
  const exportAll = async () => {
    if (!user) return;
    const tables = ['profiles', 'financial_data', 'tasks', 'mood_logs', 'portfolio_holdings'];
    const out: Record<string, any> = { exported_at: new Date().toISOString(), user_id: user.id };
    for (const tbl of tables) {
      const { data } = await (supabase as any).from(tbl).select('*').eq('user_id', user.id);
      out[tbl] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jood-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('sec.export.success'), description: t('sec.export.success.desc') });
  };

  // ── Delete account ───────────────────────────────────────────────────────────
  const deleteAccount = async () => {
    if (!user || deleteConfirm !== DELETE_WORD) return;
    setDeleting(true);
    try {
      const tables = [
        'chat_messages', 'chat_sessions', 'habit_logs', 'habits',
        'ai_recommendations', 'events', 'mood_logs', 'tasks',
        'financial_data', 'portfolio_holdings', 'ai_interactions',
        'user_agreements', 'profiles',
      ];
      for (const tbl of tables) {
        await (supabase as any).from(tbl).delete().eq('user_id', user.id);
      }
      localStorage.clear();
      toast({
        title: t('sec.delete.success'),
        description: t('sec.delete.success.desc'),
      });
      setTimeout(() => signOut(), 1500);
    } catch (err: any) {
      toast({ title: t('sec.delete.fail'), description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl mx-auto" dir={dir}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 flex items-center justify-center shadow-elegant">
          <Shield className="w-6 h-6 text-jood-gold-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-arabic text-foreground">{t('sec.title')}</h2>
          <p className="text-xs text-muted-foreground font-arabic">{t('sec.subtitle')}</p>
        </div>
      </div>

      {/* ── Security features ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Face ID */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-indigo-600" />
                </div>
                {prefs.faceId && <Badge className="bg-emerald-600 text-white text-[10px] font-arabic">{t('sec.faceid.badge')}</Badge>}
              </div>
              <h3 className="font-bold text-sm font-arabic mb-1">{t('sec.faceid.title')}</h3>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mb-3">
                {t('sec.faceid.desc')}
              </p>
              <Button
                size="sm"
                variant={prefs.faceId ? 'outline' : 'default'}
                className={cn(
                  'w-full font-arabic text-xs',
                  !prefs.faceId && 'bg-jood-teal-900 hover:bg-jood-teal-700 text-white',
                )}
                onClick={prefs.faceId ? disableFaceId : enableFaceId}
              >
                {prefs.faceId ? t('sec.faceid.disable') : t('sec.faceid.enable')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Local encryption */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px] font-arabic">{t('sec.encrypt.badge')}</Badge>
              </div>
              <h3 className="font-bold text-sm font-arabic mb-1">{t('sec.encrypt.title')}</h3>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mb-3">
                {t('sec.encrypt.desc')}
              </p>
              <div className="flex items-center justify-between text-[11px] font-arabic">
                <span className="text-muted-foreground">{t('sec.encrypt.status')}</span>
                <Switch checked={prefs.encryptLocal} onCheckedChange={v => savePrefs({ ...prefs, encryptLocal: v })} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Zero-knowledge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-jood-gold-500/5 to-transparent" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-jood-gold-500/20 flex items-center justify-center">
                  <EyeOff className="w-5 h-5 text-jood-gold-700" />
                </div>
                <Badge className="bg-jood-gold-500 text-white text-[10px] font-arabic gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> {t('sec.zerok.badge')}
                </Badge>
              </div>
              <h3 className="font-bold text-sm font-arabic mb-1">{t('sec.zerok.title')}</h3>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mb-3">
                {t('sec.zerok.desc')}
              </p>
              <div className="flex items-center justify-between text-[11px] font-arabic">
                <span className="text-muted-foreground">{t('sec.zerok.status')}</span>
                <Switch checked={prefs.zeroKnowledge} onCheckedChange={v => savePrefs({ ...prefs, zeroKnowledge: v })} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Granular data controls ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-jood-teal-700" />
            <h3 className="font-bold text-sm font-arabic">{t('sec.data.title')}</h3>
            <Badge variant="outline" className="font-arabic text-[10px] mr-auto">
              {Object.values(prefs.scopes).filter(Boolean).length} / {SCOPE_KEYS.length}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-arabic mb-4">
            {t('sec.data.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SCOPE_KEYS.map(key => {
              const Icon = SCOPE_ICONS[key];
              const on = prefs.scopes[key];
              return (
                <label
                  key={key}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                    'hover:bg-muted/30',
                    on ? 'border-jood-teal-700/40 bg-jood-teal-900/5' : 'border-border/40 opacity-60',
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    on ? 'bg-jood-teal-900 text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs font-arabic">{t(`sec.scope.${key}` as any)}</div>
                    <div className="text-[10px] text-muted-foreground font-arabic">{t(`sec.scope.${key}.desc` as any)}</div>
                  </div>
                  <Switch checked={on} onCheckedChange={() => toggleScope(key)} />
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Data portability + deletion ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-jood-teal-700" />
              <h3 className="font-bold text-sm font-arabic">{t('sec.export.title')}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground font-arabic mb-3 leading-relaxed">
              {t('sec.export.desc')}
            </p>
            <Button
              onClick={exportAll}
              variant="outline"
              size="sm"
              className="w-full font-arabic text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> {t('sec.export.btn')}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              <h3 className="font-bold text-sm font-arabic text-destructive">{t('sec.delete.title')}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground font-arabic mb-3 leading-relaxed">
              {t('sec.delete.desc')}
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="w-full font-arabic text-xs gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" /> {t('sec.delete.btn')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Delete confirmation dialog ──────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-arabic flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> {t('sec.delete.dialog.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs font-arabic text-muted-foreground">
            <p>{t('sec.delete.dialog.intro')}</p>
            <ul className="list-disc pr-5 space-y-1 text-foreground/80">
              <li>{t('sec.delete.item.chats')}</li>
              <li>{t('sec.delete.item.finance')}</li>
              <li>{t('sec.delete.item.tasks')}</li>
              <li>{t('sec.delete.item.calendar')}</li>
              <li>{t('sec.delete.item.profile')}</li>
            </ul>
            <div className="pt-2">
              <Label className="font-arabic text-xs">
                {t('sec.delete.confirm.label')}{' '}
                <span className="font-bold text-destructive">"{DELETE_WORD}"</span>{' '}
                {t('sec.delete.confirm.suffix')}
              </Label>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={DELETE_WORD}
                className="font-arabic text-sm mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="font-arabic">
              {t('sec.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== DELETE_WORD || deleting}
              onClick={deleteAccount}
              className="font-arabic gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? t('sec.delete.doing') : t('sec.delete.final')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <p className="text-[10px] text-center text-muted-foreground font-arabic leading-relaxed mt-4">
        <KeyRound className="w-3 h-3 inline ml-1" />
        {t('sec.footer')}
      </p>
    </div>
  );
};

export default SecurityCenter;
