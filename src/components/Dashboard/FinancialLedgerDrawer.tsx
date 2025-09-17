import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';

interface FinancialLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FinancialLedgerDrawer: React.FC<FinancialLedgerDrawerProps> = ({ open, onOpenChange }) => {
  const { financialEntries } = useFinancialDashboard();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Financial Ledger</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {financialEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.type === 'income' ? 'default' : entry.type === 'expense' ? 'destructive' : 'secondary'}>
                    {entry.type}
                  </Badge>
                  <span className="font-medium">{entry.category}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{entry.amount.toLocaleString()} {entry.currency}</p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};