import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FinancialEntry } from '@/hooks/useFinancialDashboard';
import { Search, Download, Trash2, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { categoryLabel } from '@/lib/financeCategories';
import { cn } from '@/lib/utils';

interface FinancialLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FinancialEntry[];
  onDelete: (id: string) => Promise<void>;
}

type EntryType = FinancialEntry['type'];

const TYPE_STYLE: Record<EntryType, { icon: React.ComponentType<{ className?: string }>; tone: string; sign: string }> = {
  income:     { icon: ArrowDownLeft, tone: 'text-jood-ok bg-jood-ok/10',              sign: '+' },
  expense:    { icon: ArrowUpRight,  tone: 'text-jood-warn bg-jood-warn/10',          sign: '−' },
  savings:    { icon: PiggyBank,     tone: 'text-jood-gold-600 dark:text-jood-gold-300 bg-jood-gold-500/12', sign: '' },
  investment: { icon: TrendingUp,    tone: 'text-jood-teal-500 bg-jood-teal-500/12',  sign: '' },
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const FinancialLedgerDrawer: React.FC<FinancialLedgerDrawerProps> = ({ open, onOpenChange, entries: financialEntries, onDelete }) => {
  const { toast } = useToast();
  const { lang, dir } = useLanguage();
  const ar = lang === 'ar';
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pendingDelete, setPendingDelete] = useState<FinancialEntry | null>(null);

  const TYPE_LABEL: Record<string, string> = ar
    ? { all: 'كل الأنواع', income: 'دخل', expense: 'مصروف', savings: 'ادخار', investment: 'استثمار' }
    : { all: 'All types', income: 'Income', expense: 'Expense', savings: 'Savings', investment: 'Investment' };

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    [ar],
  );
  const money = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);

  const titleOf = (e: FinancialEntry) => e.label?.trim() || e.description?.trim() || categoryLabel(e.category, lang);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return financialEntries.filter(entry => {
      const haystack = [entry.label, entry.description, entry.category, categoryLabel(entry.category, lang)]
        .filter(Boolean).join(' ').toLowerCase();
      return (!q || haystack.includes(q))
        && (typeFilter === 'all' || entry.type === typeFilter)
        && (categoryFilter === 'all' || entry.category === categoryFilter);
    });
  }, [financialEntries, searchTerm, typeFilter, categoryFilter, lang]);

  const categories = useMemo(
    () => Array.from(new Set(financialEntries.map(e => e.category).filter(Boolean))),
    [financialEntries],
  );

  const totals = useMemo(() => {
    const sum = (type: EntryType) => filteredEntries.filter(e => e.type === type).reduce((s, e) => s + Number(e.amount), 0);
    return { income: sum('income'), expense: sum('expense'), savings: sum('savings') };
  }, [filteredEntries]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const entry = pendingDelete;
    setPendingDelete(null);
    try {
      await onDelete(entry.id);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: ar ? 'تعذّر حذف المعاملة' : "Couldn't delete the entry",
        description: ar ? 'تحقق من اتصالك بالإنترنت، ثم حاول مرة أخرى.' : 'Check your connection, then try again.',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = () => {
    const headers = ar
      ? ['التاريخ', 'النوع', 'الفئة', 'الوصف', 'المبلغ', 'العملة']
      : ['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency'];
    const rows = filteredEntries.map(e => [
      new Date(e.date).toISOString().split('T')[0],
      TYPE_LABEL[e.type] ?? e.type,
      categoryLabel(e.category, lang),
      titleOf(e),
      e.amount,
      e.currency,
    ].map(csvCell).join(','));

    // The BOM makes Excel read the file as UTF-8 so Arabic text isn't garbled.
    const blob = new Blob(['﻿' + [headers.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jood_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
      title: ar ? 'تم تصدير السجل' : 'Ledger exported',
      description: ar ? `${filteredEntries.length} معاملة في ملف CSV.` : `${filteredEntries.length} entries saved as CSV.`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={dir === 'rtl' ? 'left' : 'right'} className="w-full sm:max-w-[560px] flex flex-col" dir={dir}>
        <SheetHeader>
          <SheetTitle className="text-xl font-bold font-arabic">{ar ? 'السجل المالي' : 'Financial ledger'}</SheetTitle>
          <SheetDescription className="font-arabic">
            {ar ? `${financialEntries.length} معاملة مسجّلة` : `${financialEntries.length} recorded entries`}
          </SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              placeholder={ar ? 'ابحث في المعاملات…' : 'Search entries…'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9 font-arabic"
              aria-label={ar ? 'بحث' : 'Search'}
            />
          </div>

          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36 font-arabic" aria-label={ar ? 'النوع' : 'Type'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['all', 'income', 'expense', 'savings'].map(v => (
                  <SelectItem key={v} value={v} className="font-arabic">{TYPE_LABEL[v]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 font-arabic" aria-label={ar ? 'الفئة' : 'Category'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-arabic">{ar ? 'كل الفئات' : 'All categories'}</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category} className="font-arabic">{categoryLabel(category, lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={exportToCSV}
              disabled={filteredEntries.length === 0}
              aria-label={ar ? 'تصدير CSV' : 'Export CSV'}
              title={ar ? 'تصدير CSV' : 'Export CSV'}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Entries */}
        <ul className="mt-4 flex-1 min-h-0 overflow-y-auto space-y-2 -mx-1 px-1">
          {filteredEntries.length === 0 ? (
            <li className="text-center py-10 text-muted-foreground font-arabic">
              <Filter className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground">{ar ? 'لا توجد معاملات مطابقة' : 'No matching entries'}</p>
              <p className="text-sm">{ar ? 'غيّر البحث أو الفلاتر، أو أضف معاملة جديدة.' : 'Change the search or filters, or add a new entry.'}</p>
            </li>
          ) : (
            filteredEntries.map((entry) => {
              const style = TYPE_STYLE[entry.type] ?? TYPE_STYLE.expense;
              const Icon = style.icon;
              return (
                <li key={entry.id} className="group flex items-center gap-3 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-border/40 px-3 py-2.5 transition-colors">
                  <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', style.tone)}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-arabic text-foreground truncate">{titleOf(entry)}</p>
                    <p className="text-[11px] text-muted-foreground font-arabic truncate">
                      {categoryLabel(entry.category, lang)} · {dateFmt.format(new Date(entry.date))}
                    </p>
                  </div>
                  <p className={cn('font-mono text-sm font-bold whitespace-nowrap', entry.type === 'income' ? 'text-jood-ok' : 'text-foreground')} dir="ltr">
                    {style.sign}{money(Number(entry.amount))} <span className="text-[10px] text-muted-foreground font-normal">{entry.currency}</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDelete(entry)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    aria-label={ar ? `حذف ${titleOf(entry)}` : `Delete ${titleOf(entry)}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })
          )}
        </ul>

        {/* Totals for the current filter */}
        {filteredEntries.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
            {([
              ['income', ar ? 'الدخل' : 'Income', 'text-jood-ok'],
              ['expense', ar ? 'المصاريف' : 'Expenses', 'text-jood-warn'],
              ['savings', ar ? 'الادخار' : 'Savings', 'text-jood-gold-600 dark:text-jood-gold-300'],
            ] as const).map(([key, label, tone]) => (
              <div key={key}>
                <p className="text-[11px] text-muted-foreground font-arabic">{label}</p>
                <p className={cn('font-mono text-sm font-bold whitespace-nowrap', tone)} dir="ltr">
                  {money(totals[key])} <span className="text-[10px] font-normal text-muted-foreground">SAR</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </SheetContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-arabic">{ar ? 'حذف هذه المعاملة؟' : 'Delete this entry?'}</AlertDialogTitle>
            <AlertDialogDescription className="font-arabic">
              {pendingDelete && (ar
                ? `«${titleOf(pendingDelete)}» بمبلغ ${money(Number(pendingDelete.amount))} ${pendingDelete.currency}. لا يمكن التراجع عن الحذف.`
                : `“${titleOf(pendingDelete)}” for ${money(Number(pendingDelete.amount))} ${pendingDelete.currency}. This can't be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-arabic">{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="font-arabic bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {ar ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};
