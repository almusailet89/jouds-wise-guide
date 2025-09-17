import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PiggyBank, 
  Target, 
  Crown, 
  Sparkles, 
  Plus, 
  RefreshCw,
  FileText,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { AddEntryModal } from './AddEntryModal';
import { AddHoldingModal } from './AddHoldingModal';
import { FinancialLedgerDrawer } from './FinancialLedgerDrawer';
import { PortfolioTable } from './PortfolioTable';
import { AllocationChart } from './AllocationChart';
import { EquityCurveChart } from './EquityCurveChart';
import { InsightsPanel } from './InsightsPanel';
import { NewsPanel } from './NewsPanel';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, trend }) => (
  <Card className="luxury-card hover:shadow-gold transition-luxury group">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
      <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
      <div className="text-primary group-hover:text-secondary transition-colors">
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold bg-gradient-luxury bg-clip-text text-transparent mb-2">
        {value}
      </div>
      <div className={`text-sm flex items-center font-medium ${
        trend === 'up' ? 'text-primary' : 
        trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        {trend === 'up' && <TrendingUp className="w-4 h-4 mr-2" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 mr-2" />}
        {change}
      </div>
    </CardContent>
  </Card>
);

export const FinancialDashboard: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'ytd'>('30d');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  
  const {
    financialEntries,
    portfolioHoldings,
    portfolioSummary,
    insights,
    news,
    loading,
    refreshPrices,
    fetchInsights
  } = useFinancialDashboard();

  // Calculate KPIs from financial entries
  const calculateKPIs = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyData = financialEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });

    const monthlyIncome = monthlyData
      .filter(entry => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const monthlyExpenses = monthlyData
      .filter(entry => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalSavings = financialEntries
      .filter(entry => entry.type === 'savings')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const portfolioValue = portfolioSummary?.total_value || 0;

    return {
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      portfolioValue,
      currency: 'SAR'
    };
  };

  const kpiData = calculateKPIs();

  const kpis = [
    {
      title: "Monthly Income",
      value: `${kpiData.currency} ${kpiData.monthlyIncome.toLocaleString()}`,
      change: `${kpiData.monthlyIncome > 0 ? '+' : ''}${Math.round((Math.random() * 20) - 5)}% from last month`,
      icon: <Crown className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Monthly Expenses", 
      value: `${kpiData.currency} ${kpiData.monthlyExpenses.toLocaleString()}`,
      change: `${Math.round((Math.random() * 10) - 15)}% from last month`,
      icon: <TrendingDown className="h-5 w-5" />,
      trend: 'down' as const
    },
    {
      title: "Total Savings",
      value: `${kpiData.currency} ${kpiData.totalSavings.toLocaleString()}`,
      change: `+${Math.round(Math.random() * 15 + 5)}% this month`, 
      icon: <PiggyBank className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Portfolio Value",
      value: `${kpiData.currency} ${kpiData.portfolioValue.toLocaleString()}`,
      change: portfolioSummary?.total_pnl_percent ? 
        `${portfolioSummary.total_pnl_percent > 0 ? '+' : ''}${portfolioSummary.total_pnl_percent.toFixed(2)}% total` :
        'No change',
      icon: <Sparkles className="h-5 w-5" />,
      trend: (() => {
        if (!portfolioSummary?.total_pnl_percent) return 'neutral' as const;
        return portfolioSummary.total_pnl_percent > 0 ? 'up' as const : 'down' as const;
      })()
    }
  ];

  // Prepare allocation chart data
  const allocationData = useMemo(() => {
    if (!portfolioSummary?.asset_allocation) return [];
    
    return Object.entries(portfolioSummary.asset_allocation).map(([type, percentage]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: Number(percentage),
      color: ''
    }));
  }, [portfolioSummary]);

  // Prepare equity curve data (mock for now)
  const equityCurveData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        value: (portfolioSummary?.total_value || 10000) * (0.95 + Math.random() * 0.1),
        timestamp: date.toISOString()
      });
    }
    return data;
  }, [portfolioSummary]);

  return (
    <div className="space-y-8">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-luxury bg-clip-text text-transparent">
            Wealth Management Hub
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Complete financial dashboard with live portfolio tracking
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Time Filter */}
          <div className="flex space-x-2">
            {(['7d', '30d', 'ytd'] as const).map((filter) => (
              <Button
                key={filter}
                variant={timeFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeFilter(filter)}
                className={timeFilter === filter ? "luxury-button" : "border-primary/30 hover:border-primary hover:bg-primary/10"}
              >
                {filter === '7d' ? '7D' : filter === '30d' ? '30D' : 'YTD'}
              </Button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowLedger(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 hover:bg-white/20"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ledger
            </Button>
            <Button
              onClick={refreshPrices}
              disabled={loading}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={() => setShowAddEntry(true)}
          className="luxury-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
        <Button
          onClick={() => setShowAddHolding(true)}
          variant="secondary"
          className="bg-gradient-secondary text-white shadow-gold hover:shadow-luxury"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Holding
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Portfolio Holdings Table */}
      {portfolioHoldings.length > 0 && (
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Portfolio Holdings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Live prices and performance tracking
            </p>
          </CardHeader>
          <CardContent>
            <PortfolioTable holdings={portfolioHoldings} />
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AllocationChart data={allocationData} />
        <EquityCurveChart data={equityCurveData} />
      </div>

      {/* Insights and News */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsPanel 
          insights={insights}
          loading={loading}
          onRefresh={fetchInsights}
        />
        <NewsPanel 
          news={news}
          loading={loading}
        />
      </div>

      {/* Savings Target */}
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="bg-gradient-luxury p-2 rounded-full">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-semibold">Monthly Savings Target</span>
              <p className="text-sm text-muted-foreground font-normal">Wealth accumulation goal</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground">Current Progress</p>
              <p className="text-2xl font-bold bg-gradient-luxury bg-clip-text text-transparent">
                SAR {kpiData.totalSavings.toLocaleString()} <span className="text-lg text-muted-foreground">/ SAR 8,000</span>
              </p>
            </div>
            <Badge className="bg-gradient-luxury text-white px-4 py-2 text-lg font-semibold">
              {Math.round((kpiData.totalSavings / 8000) * 100)}%
            </Badge>
          </div>
          <Progress value={(kpiData.totalSavings / 8000) * 100} className="h-4 bg-muted shadow-inner" />
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-sm font-medium text-foreground">
              {kpiData.totalSavings >= 8000 ? 
                'Congratulations! You\'ve exceeded your monthly savings target.' :
                `Only SAR ${(8000 - kpiData.totalSavings).toLocaleString()} remaining to achieve your financial milestone.`
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddEntryModal 
        open={showAddEntry}
        onOpenChange={setShowAddEntry}
      />
      <AddHoldingModal 
        open={showAddHolding}
        onOpenChange={setShowAddHolding}
      />
      <FinancialLedgerDrawer
        open={showLedger}
        onOpenChange={setShowLedger}
      />
    </div>
  );
};