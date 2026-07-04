import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2 } from 'lucide-react';

interface AddEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES_AR = {
  income:  ['الراتب', 'عمل حر', 'استثمار', 'أعمال', 'مكافأة', 'أخرى'],
  expense: ['مطاعم وطعام', 'مواصلات', 'سكن وإيجار', 'صحة', 'ترفيه', 'تسوق', 'فواتير', 'تعليم', 'أخرى'],
  savings: ['صندوق الطوارئ', 'استثمار', 'هدف محدد', 'أخرى'],
};
const CATEGORIES_EN = {
  income:  ['Salary', 'Freelance', 'Investment', 'Business', 'Bonus', 'Other'],
  expense: ['Food & Dining', 'Transport', 'Housing & Rent', 'Health', 'Entertainment', 'Shopping', 'Bills', 'Education', 'Other'],
  savings: ['Emergency Fund', 'Investment', 'Specific Goal', 'Other'],
};

export const AddEntryModal: React.FC<AddEntryModalProps> = ({ open, onOpenChange }) => {
  const { addFinancialEntry } = useFinancialDashboard();
  const { t, tg, lang, dir } = useLanguage();
  const CATEGORIES = lang === 'ar' ? CATEGORIES_AR : CATEGORIES_EN;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: '' as 'income' | 'expense' | 'savings',
    amount: '',
    currency: 'SAR',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.amount) return;
    setLoading(true);
    try {
      await addFinancialEntry({
        type:        form.type,
        amount:      parseFloat(form.amount),
        currency:    form.currency,
        category:    form.category || (lang === 'ar' ? 'عام' : 'General'),
        description: form.description,
        date:        new Date(form.date).toISOString(),
      });
      setForm({ type: '' as any, amount: '', currency: 'SAR', category: '', description: '', date: new Date().toISOString().split('T')[0] });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABELS = { income: t('entry.type.income'), expense: t('entry.type.expense'), savings: t('entry.type.savings') };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl">{t('entry.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">{t('entry.type')} *</Label>
              <Select value={form.type} onValueChange={v => set('type', v as any)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue placeholder={tg('entry.type.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(['income', 'expense', 'savings'] as const).map(t => (
                    <SelectItem key={t} value={t} className="font-arabic">{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">{t('entry.amount')} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="٠٫٠٠"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="text-right"
                required
              />
            </div>
          </div>

          {/* Currency + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">{t('entry.currency')}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">🇸🇦 {lang === 'ar' ? 'ريال سعودي' : 'Saudi Riyal'}</SelectItem>
                  <SelectItem value="USD">🇺🇸 {lang === 'ar' ? 'دولار' : 'US Dollar'}</SelectItem>
                  <SelectItem value="EUR">🇪🇺 {lang === 'ar' ? 'يورو' : 'Euro'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">{t('entry.date')}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category */}
          {form.type && (
            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">{t('entry.category')}</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue placeholder={tg('entry.category.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES[form.type]?.map(cat => (
                    <SelectItem key={cat} value={cat} className="font-arabic">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="font-arabic text-xs">{t('entry.note')}</Label>
            <Textarea
              placeholder={t('entry.note.placeholder')}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="font-arabic text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="font-arabic">
              {t('entry.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !form.type || !form.amount}
              className="font-arabic bg-jood-teal-900 hover:bg-jood-teal-700 text-white"
            >
              {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> {t('entry.saving')}</> : t('entry.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
