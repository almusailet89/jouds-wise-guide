import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { Search, Download, Edit, Trash2, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FinancialLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FinancialLedgerDrawer: React.FC<FinancialLedgerDrawerProps> = ({ open, onOpenChange }) => {
  const { financialEntries, deleteFinancialEntry } = useFinancialDashboard();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Filter entries
  const filteredEntries = financialEntries.filter(entry => {
    const matchesSearch = entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(financialEntries.map(entry => entry.category)));

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteFinancialEntry(id);
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  const exportToCSV = () => {
    if (filteredEntries.length === 0) {
      toast({
        title: "No Data",
        description: "No entries to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Description'];
    const csvContent = [
      headers.join(','),
      ...filteredEntries.map(entry => [
        new Date(entry.date).toLocaleDateString(),
        entry.type,
        entry.category,
        entry.amount,
        entry.currency,
        `"${entry.description || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "Financial ledger exported as CSV.",
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'expense':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'savings':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income':
        return '💰';
      case 'expense':
        return '💸';
      case 'savings':
        return '🏦';
      default:
        return '📊';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Financial Ledger</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={filteredEntries.length === 0}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Entries List */}
          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No entries found</p>
                <p className="text-sm">Try adjusting your filters or add new entries</p>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">{getTypeIcon(entry.type)}</span>
                      <Badge className={getTypeColor(entry.type)}>
                        {entry.type}
                      </Badge>
                      <span className="font-medium text-foreground">{entry.category}</span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-muted-foreground mb-1">{entry.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {entry.amount.toLocaleString()} {entry.currency}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          {filteredEntries.length > 0 && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="font-bold text-green-600">
                    SAR {filteredEntries
                      .filter(e => e.type === 'income')
                      .reduce((sum, e) => sum + e.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="font-bold text-red-600">
                    SAR {filteredEntries
                      .filter(e => e.type === 'expense')
                      .reduce((sum, e) => sum + e.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Savings</p>
                  <p className="font-bold text-blue-600">
                    SAR {filteredEntries
                      .filter(e => e.type === 'savings')
                      .reduce((sum, e) => sum + e.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};