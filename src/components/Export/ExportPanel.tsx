import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExport } from '@/hooks/useExport';
import { useSubscription } from '@/hooks/useSubscription';
import { useRoles } from '@/hooks/useRoles';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FileSpreadsheet, Loader2, Crown, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ExportPanel = () => {
  const { exportFinancialData, exportTasks, exportMoodData, exportAllData, exporting } = useExport();
  const { canAccessFeature, isSubscribed } = useSubscription();
  const { isAdmin } = useRoles();
  const { toast } = useToast();
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const unlocked = isSubscribed || isAdmin();

  const handleExport = async (
    exportFunction: (format: 'csv' | 'pdf') => Promise<void>,
    format: 'csv' | 'pdf',
    name: string
  ) => {
    if (!canAccessFeature('export') && !isAdmin()) {
      toast({
        title: L('التصدير متاح للمشتركين', 'Export is for subscribers'),
        description: L('يمكنك تنزيل نسخة كاملة من بياناتك مجاناً من الإعدادات ← الخصوصية.', 'You can download a full copy of your data for free in Settings → Privacy.'),
      });
      return;
    }

    try {
      setActiveExport(`${name}-${format}`);
      await exportFunction(format);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: L('تعذّر التصدير', "Couldn't export"),
        description: L('حاول مرة أخرى بعد قليل.', 'Please try again in a moment.'),
        variant: 'destructive',
      });
    } finally {
      setActiveExport(null);
    }
  };

  const exportOptions = [
    {
      id: 'financial',
      title: L('البيانات المالية', 'Financial data'),
      description: L('الدخل والمصاريف والادخار والاستثمار', 'Income, expenses, savings and investments'),
      icon: FileSpreadsheet,
      exportFn: exportFinancialData,
    },
    {
      id: 'tasks',
      title: L('المهام والتخطيط', 'Tasks & planning'),
      description: L('قوائم المهام والمواعيد', 'Your task lists and schedules'),
      icon: FileText,
      exportFn: exportTasks,
    },
    {
      id: 'mood',
      title: L('سجل المزاج', 'Mood log'),
      description: L('تسجيلات المزاج والعافية', 'Mood and wellbeing entries'),
      icon: FileText,
      exportFn: exportMoodData,
    },
    {
      id: 'complete',
      title: L('تقرير شامل', 'Complete report'),
      description: L('كل بياناتك في تقرير واحد', 'All your data in one report'),
      icon: Download,
      exportFn: exportAllData,
      premium: true,
    },
  ];

  return (
    <div className="space-y-5 font-arabic" dir={dir}>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-1">{L('تصدير بياناتك', 'Export your data')}</h2>
        <p className="text-muted-foreground text-sm">
          {L('نزّل بياناتك بصيغة CSV أو PDF للاحتفاظ بها.', 'Download your data as CSV or PDF for your records.')}
        </p>
      </div>

      {!unlocked && (
        <div className="rounded-2xl bg-gradient-luxury p-6 text-center text-white">
          <Crown className="w-10 h-10 text-jood-gold-200 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">{L('ميزة للمشتركين', 'Subscriber feature')}</h3>
          <p className="text-white/85 text-sm mb-4">
            {L('التصدير بصيغ CSV وPDF متاح مع اشتراك JOOD AI. نسخة بياناتك الكاملة متاحة مجاناً من الإعدادات ← الخصوصية.',
               'CSV and PDF export comes with a JOOD AI subscription. A full copy of your data is free in Settings → Privacy.')}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/pricing')}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
          >
            {L('اعرف المزيد عن الاشتراك', 'Learn about subscriptions')}
          </Button>
        </div>
      )}

      {isAdmin() && (
        <div className="rounded-xl border border-jood-gold-500/30 bg-jood-gold-500/10 p-3 text-center">
          <p className="text-sm font-medium text-jood-gold-700 dark:text-jood-gold-300 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            {L('صلاحية مشرف: كل الميزات مفتوحة', 'Admin access: all features unlocked')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportOptions.map((option) => (
          <Card key={option.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-jood-gold-500/15">
                  <option.icon className="w-5 h-5 text-jood-gold-600 dark:text-jood-gold-300" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    {option.title}
                    {option.premium && (
                      <Badge variant="secondary" className="bg-jood-gold-500/20 text-jood-gold-700 dark:text-jood-gold-200 border-0">
                        {L('مميز', 'Premium')}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex gap-2">
              {(['csv', 'pdf'] as const).map(format => {
                const Icon = format === 'csv' ? FileSpreadsheet : FileText;
                return (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(option.exportFn, format, option.id)}
                    disabled={exporting || !unlocked}
                    className="flex-1 gap-2"
                  >
                    {activeExport === `${option.id}-${format}`
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Icon className="w-4 h-4" />}
                    {format.toUpperCase()}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-2">{L('عن ملفات التصدير', 'About exports')}</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc ps-5">
            <li>{L('CSV: للفتح في Excel أو Numbers أو Google Sheets.', 'CSV: open in Excel, Numbers or Google Sheets.')}</li>
            <li>{L('PDF: للتقارير والحفظ والطباعة.', 'PDF: for reports, records and printing.')}</li>
            <li>{L('تُنزَّل الملفات مباشرة من حسابك إلى جهازك.', 'Files download straight from your account to your device.')}</li>
            <li>{L('أسماء الملفات تتضمن التاريخ لسهولة الترتيب.', 'File names include the date for easy sorting.')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
