import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { Loader2 } from 'lucide-react';

interface AddEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = {
  income:  ['الراتب', 'عمل حر', 'استثمار', 'أعمال', 'مكافأة', 'أخرى'],
  expense: ['مطاعم وطعام', 'مواصلات', 'سكن وإيجار', 'صحة', 'ترفيه', 'تسوق', 'فواتير', 'تعليم', 'أخرى'],
  savings: ['صندوق الطوارئ', 'استثمار', 'هدف محدد', 'أخرى'],
};

export const AddEntryModal: React.FC<AddEntryModalProps> = ({ open, onOpenChange }) => {
  const { addFinancialEntry } = useFinancialDashboard();
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
        category:    form.category || 'عام',
        description: form.description,
        date:        new Date(form.date).toISOString(),
      });
      setForm({ type: '' as any, amount: '', currency: 'SAR', category: '', description: '', date: new Date().toISOString().split('T')[0] });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABELS = { income: '💰 دخل', expense: '💸 مصروف', savings: '🏦 ادخار' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl">إضافة معاملة مالية</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">النوع *</Label>
              <Select value={form.type} onValueChange={v => set('type', v as any)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue placeholder="اختاري النوع" />
                </SelectTrigger>
                <SelectContent>
                  {(['income', 'expense', 'savings'] as const).map(t => (
                    <SelectItem key={t} value={t} className="font-arabic">{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">المبلغ *</Label>
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
              <Label className="font-arabic text-xs">العملة</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">🇸🇦 ريال سعودي</SelectItem>
                  <SelectItem value="USD">🇺🇸 دولار</SelectItem>
                  <SelectItem value="EUR">🇪🇺 يورو</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-arabic text-xs">التاريخ</Label>
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
              <Label className="font-arabic text-xs">الفئة</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger className="font-arabic">
                  <SelectValue placeholder="اختاري الفئة" />
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
            <Label className="font-arabic text-xs">ملاحظة (اختياري)</Label>
            <Textarea
              placeholder="مثال: غداء مع العائلة..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="font-arabic text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="font-arabic">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading || !form.type || !form.amount}
              className="font-arabic bg-jood-teal-900 hover:bg-jood-teal-700 text-white"
            >
              {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ الحفظ...</> : 'حفظ المعاملة'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
