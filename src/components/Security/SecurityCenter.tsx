import { useState } from 'react';
import {
  AlertTriangle, Bot, Database, Download, KeyRound, Loader2,
  LockKeyhole, Shield, ShieldCheck, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { clearPrivateClientState } from '@/lib/privacy';

interface AccountExport {
  exported_at: string;
  user_id: string;
  data: Record<string, unknown[]>;
}

export const SecurityCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteWord = t('sec.delete.confirm.word');

  const exportAll = async () => {
    if (!user || exporting) return;
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke<AccountExport>('export-account-data');
      if (error) throw error;
      if (!data?.data) throw new Error(t('sec.export.invalid'));

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jood-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: t('sec.export.success'), description: t('sec.export.success.desc') });
    } catch (error) {
      toast({
        title: t('sec.export.fail'),
        description: error instanceof Error ? error.message : t('sec.export.fail.desc'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || deleting || deleteConfirm !== deleteWord) return;
    setDeleting(true);

    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: deleteWord },
      });
      if (error) throw error;

      await supabase.auth.signOut({ scope: 'local' });
      await clearPrivateClientState();
      window.location.assign('/');
    } catch (error) {
      toast({
        title: t('sec.delete.fail'),
        description: error instanceof Error ? error.message : t('sec.delete.fail.desc'),
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5" dir={dir}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 shadow-elegant">
          <Shield className="h-6 w-6 text-jood-gold-300" />
        </div>
        <div>
          <h2 className="font-arabic text-xl font-bold text-foreground">{t('sec.title')}</h2>
          <p className="font-arabic text-xs text-muted-foreground">{t('sec.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <LockKeyhole className="h-5 w-5 text-emerald-700" />
              </div>
              <Badge variant="secondary" className="font-arabic text-[10px]">{t('sec.connection.badge')}</Badge>
            </div>
            <h3 className="mb-1 font-arabic text-sm font-bold">{t('sec.connection.title')}</h3>
            <p className="font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.connection.desc')}</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <ShieldCheck className="h-5 w-5 text-indigo-700" />
            </div>
            <h3 className="mb-1 font-arabic text-sm font-bold">{t('sec.session.title')}</h3>
            <p className="font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.session.desc')}</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-jood-gold-500/20">
              <Bot className="h-5 w-5 text-jood-gold-700" />
            </div>
            <h3 className="mb-1 font-arabic text-sm font-bold">{t('sec.ai.title')}</h3>
            <p className="font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.ai.desc')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-jood-teal-700" />
            <h3 className="font-arabic text-sm font-bold">{t('sec.data.title')}</h3>
          </div>
          <p className="font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.data.subtitle')}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Download className="h-4 w-4 text-jood-teal-700" />
              <h3 className="font-arabic text-sm font-bold">{t('sec.export.title')}</h3>
            </div>
            <p className="mb-3 font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.export.desc')}</p>
            <Button onClick={exportAll} variant="outline" size="sm" disabled={exporting} className="w-full gap-1.5 font-arabic text-xs">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? t('sec.export.doing') : t('sec.export.btn')}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <h3 className="font-arabic text-sm font-bold text-destructive">{t('sec.delete.title')}</h3>
            </div>
            <p className="mb-3 font-arabic text-[11px] leading-relaxed text-muted-foreground">{t('sec.delete.desc')}</p>
            <Button variant="destructive" size="sm" className="w-full gap-1.5 font-arabic text-xs" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> {t('sec.delete.btn')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={open => {
        if (!deleting) {
          setDeleteOpen(open);
          if (!open) setDeleteConfirm('');
        }
      }}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-arabic text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t('sec.delete.dialog.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 font-arabic text-xs text-muted-foreground">
            <p>{t('sec.delete.dialog.intro')}</p>
            <ul className="list-disc space-y-1 ps-5 text-foreground/80">
              <li>{t('sec.delete.item.chats')}</li>
              <li>{t('sec.delete.item.finance')}</li>
              <li>{t('sec.delete.item.tasks')}</li>
              <li>{t('sec.delete.item.calendar')}</li>
              <li>{t('sec.delete.item.profile')}</li>
            </ul>
            <p className="rounded-lg bg-destructive/5 p-2 text-[11px] text-destructive">{t('sec.delete.billing')}</p>
            <div className="pt-2">
              <Label className="font-arabic text-xs">
                {t('sec.delete.confirm.label')} <span className="font-bold text-destructive">“{deleteWord}”</span> {t('sec.delete.confirm.suffix')}
              </Label>
              <Input value={deleteConfirm} onChange={event => setDeleteConfirm(event.target.value)} placeholder={deleteWord} disabled={deleting} className="mt-1 font-arabic text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)} className="font-arabic">{t('sec.delete.cancel')}</Button>
            <Button variant="destructive" disabled={deleteConfirm !== deleteWord || deleting} onClick={deleteAccount} className="gap-1.5 font-arabic">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {deleting ? t('sec.delete.doing') : t('sec.delete.final')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-center font-arabic text-[10px] leading-relaxed text-muted-foreground">
        <KeyRound className="me-1 inline h-3 w-3" /> {t('sec.footer')}
      </p>
    </div>
  );
};

export default SecurityCenter;
