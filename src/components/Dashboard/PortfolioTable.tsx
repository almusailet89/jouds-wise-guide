import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortfolioHolding, useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface PortfolioTableProps {
  holdings: PortfolioHolding[];
}

export const PortfolioTable: React.FC<PortfolioTableProps> = ({ holdings }) => {
  const { deletePortfolioHolding } = useFinancialDashboard();
  const { t, lang, dir } = useLanguage();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm(t('port.delete.confirm'))) {
      setDeletingId(id);
      try {
        await deletePortfolioHolding(id);
      } catch (error) {
        console.error('Error deleting holding:', error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getAssetIcon = (assetType: string) => {
    switch (assetType) {
      case 'stock':       return '📈';
      case 'crypto':      return '₿';
      case 'real_estate': return '🏠';
      default:            return '📊';
    }
  };

  const getAssetTypeLabel = (assetType: string) => {
    const key = `port.type.${assetType}`;
    const translated = t(key);
    // Fallback: humanise the raw value if key not found
    return translated !== key ? translated : assetType.replace('_', ' ');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString('en')} ${currency}`;
  };

  const calculatePnL = (holding: PortfolioHolding) => {
    const currentPrice = holding.current_price || holding.avg_price || 0;
    const buyPrice = holding.avg_price || 0;
    const quantity = holding.quantity || 1;
    const pnl = (currentPrice - buyPrice) * quantity;
    const pnlPercent = buyPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
    return { pnl, pnlPercent };
  };

  const dtLocale = lang === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="rounded-md border border-border/50 overflow-hidden" dir={dir}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="font-semibold font-arabic">{t('port.col.asset')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.type')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.qty')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.buy')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.current')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.pl')}</TableHead>
            <TableHead className="font-semibold font-arabic">{t('port.col.updated')}</TableHead>
            <TableHead className="font-semibold font-arabic w-20">{t('port.col.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <TrendingUp className="h-12 w-12 opacity-50" />
                  <p className="font-medium font-arabic">{t('port.empty.title')}</p>
                  <p className="text-sm font-arabic">{t('port.empty.hint')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            holdings.map((holding) => {
              const { pnl, pnlPercent } = calculatePnL(holding);
              const isPositive = pnl >= 0;

              return (
                <TableRow key={holding.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getAssetIcon(holding.asset_type)}</span>
                      <div>
                        <div className="font-medium">
                          {holding.symbol || holding.address || 'Unknown'}
                        </div>
                        {holding.property_type && (
                          <div className="text-sm text-muted-foreground font-arabic">
                            {holding.property_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-arabic capitalize">
                      {getAssetTypeLabel(holding.asset_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {holding.asset_type === 'real_estate'
                      ? t('port.property')
                      : (holding.quantity || 0).toLocaleString('en')}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(holding.avg_price || 0, holding.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {formatCurrency(holding.current_price || holding.avg_price || 0, holding.currency)}
                      {holding.current_price && holding.current_price !== holding.avg_price && (
                        <div className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(pnl, holding.currency)}
                      <div className="text-xs">
                        ({isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {holding.last_updated
                      ? new Date(holding.last_updated).toLocaleDateString(dtLocale)
                      : t('port.never')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(holding.id)}
                        disabled={deletingId === holding.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
