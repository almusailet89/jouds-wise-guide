import { useState } from 'react';
import { useExport } from '@/hooks/useExport';
import { useSubscription } from '@/hooks/useSubscription';
import { useRoles } from '@/hooks/useRoles';
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
  const [activeExport, setActiveExport] = useState<string | null>(null);

  const handleExport = async (
    exportFunction: (format: 'csv' | 'pdf') => Promise<void>,
    format: 'csv' | 'pdf',
    name: string
  ) => {
    if (!canAccessFeature('export') && !isAdmin()) {
      toast({
        title: "Premium Feature",
        description: "Export functionality is available with a subscription.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActiveExport(`${name}-${format}`);
      await exportFunction(format);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setActiveExport(null);
    }
  };

  const exportOptions = [
    {
      id: 'financial',
      title: 'Financial Data',
      description: 'Export income, expenses, and investment data',
      icon: FileSpreadsheet,
      exportFn: exportFinancialData,
    },
    {
      id: 'tasks',
      title: 'Tasks & Planning',
      description: 'Export your task lists and schedules',
      icon: FileText,
      exportFn: exportTasks,
    },
    {
      id: 'mood',
      title: 'Mood Tracking',
      description: 'Export mood logs and wellness data',
      icon: FileText,
      exportFn: exportMoodData,
    },
    {
      id: 'complete',
      title: 'Complete Report',
      description: 'Export all your data in one comprehensive report',
      icon: Download,
      exportFn: exportAllData,
      premium: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Export Your Data</h2>
        <p className="text-muted-foreground">
          Download your personal data in CSV or PDF format for your records
        </p>
      </div>

      {!isSubscribed && !isAdmin() && (
        <Card className="bg-gradient-elegant border-white/20">
          <CardContent className="p-6 text-center">
            <Crown className="w-12 h-12 text-white mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Premium Feature</h3>
            <p className="text-white/80 mb-4">
              Export functionality is available with a Joud AI subscription
            </p>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin() && (
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary">
              Admin Access: All premium features unlocked
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportOptions.map((option) => (
          <Card key={option.id} className="bg-card/80 backdrop-blur border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <option.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {option.title}
                      {option.premium && (
                        <Badge variant="secondary" className="bg-gradient-elegant text-white">
                          Premium
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(option.exportFn, 'csv', option.id)}
                  disabled={exporting || (!isSubscribed && !isAdmin())}
                  className="flex-1"
                >
                  {activeExport === `${option.id}-csv` ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                  )}
                  CSV
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(option.exportFn, 'pdf', option.id)}
                  disabled={exporting || (!isSubscribed && !isAdmin())}
                  className="flex-1"
                >
                  {activeExport === `${option.id}-pdf` ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/80 backdrop-blur border-white/10">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">Export Information</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>CSV Format:</strong> Best for importing into spreadsheet applications</li>
            <li>• <strong>PDF Format:</strong> Perfect for reports and record keeping</li>
            <li>• <strong>Data Privacy:</strong> Your data is exported directly from your account</li>
            <li>• <strong>File Naming:</strong> Files include date stamps for easy organization</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};