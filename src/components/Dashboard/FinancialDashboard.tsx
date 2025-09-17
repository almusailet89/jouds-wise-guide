import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, AlertCircle, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
  const [portfolio, setPortfolio] = useState<any>(null);

  useEffect(() => {
    // Load financial data from local storage
    const loadFinancialData = () => {
      const data = localStorage.getItem('joud_finance_data');
      if (data) {
        setPortfolio(JSON.parse(data));
      } else {
        // Initialize with sample data
        const sampleData = {
          monthlyIncome: 15000,
          monthlyExpenses: 8500,
          totalSavings: 45000,
          investments: 25000,
          currency: 'SAR'
        };
        localStorage.setItem('joud_finance_data', JSON.stringify(sampleData));
        setPortfolio(sampleData);
      }
      
      toast.success("Financial data loaded", {
        description: "Your luxury portfolio is ready for analysis"
      });
    };
    
    loadFinancialData();
  }, []);

  const kpis = portfolio ? [
    {
      title: "Monthly Income",
      value: `${portfolio.currency} ${portfolio.monthlyIncome.toLocaleString()}`,
      change: "+12% from last month",
      icon: <Crown className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Monthly Expenses", 
      value: `${portfolio.currency} ${portfolio.monthlyExpenses.toLocaleString()}`,
      change: "-5% from last month",
      icon: <TrendingDown className="h-5 w-5" />,
      trend: 'down' as const
    },
    {
      title: "Total Savings",
      value: `${portfolio.currency} ${portfolio.totalSavings.toLocaleString()}`,
      change: "+8% this month", 
      icon: <PiggyBank className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Investments",
      value: `${portfolio.currency} ${portfolio.investments.toLocaleString()}`,
      change: "+15% this month",
      icon: <Sparkles className="h-5 w-5" />,
      trend: 'up' as const
    }
  ] : [];

  const alerts = [
    {
      type: 'success',
      message: "ARAMCO stock performance exceeds expectations (+12%) - premium exit opportunity detected",
      time: "1 hour ago",
      priority: 'high'
    },
    {
      type: 'warning', 
      message: "Luxury spending category trending above optimal threshold - refinement suggested",
      time: "3 hours ago",
      priority: 'medium'
    },
    {
      type: 'info',
      message: "Prestigious savings milestone achieved! Your financial discipline reflects excellence ✨",
      time: "1 day ago",
      priority: 'low'
    },
    {
      type: 'success',
      message: "Portfolio diversification strategy performing with distinction (+18% YTD)",
      time: "2 days ago", 
      priority: 'high'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Luxury Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-luxury bg-clip-text text-transparent">
            Financial Portfolio
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Sophisticated wealth management at your fingertips
          </p>
        </div>
        
        {/* Luxury Time Filter */}
        <div className="flex space-x-2">
          {(['7d', '30d', 'ytd'] as const).map((filter) => (
            <Button
              key={filter}
              variant={timeFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeFilter(filter)}
              className={timeFilter === filter ? "luxury-button" : "border-primary/30 hover:border-primary hover:bg-primary/10"}
            >
              {filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : 'Year to Date'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Luxury Savings Target */}
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="bg-gradient-luxury p-2 rounded-full">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-semibold">Prestigious Savings Target</span>
              <p className="text-sm text-muted-foreground font-normal">Monthly wealth accumulation goal</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground">Current Progress</p>
              <p className="text-2xl font-bold bg-gradient-luxury bg-clip-text text-transparent">
                SAR 6,500 <span className="text-lg text-muted-foreground">/ SAR 8,000</span>
              </p>
            </div>
            <Badge className="bg-gradient-luxury text-white px-4 py-2 text-lg font-semibold">
              81%
            </Badge>
          </div>
          <Progress value={81} className="h-4 bg-muted shadow-inner" />
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-sm font-medium text-foreground">
              Excellent progress! Only <span className="text-primary font-semibold">SAR 1,500</span> remaining to achieve your distinguished financial milestone.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Luxury Smart Insights */}
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="bg-gradient-secondary p-2 rounded-full">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-semibold">AI-Powered Insights</span>
              <p className="text-sm text-muted-foreground font-normal">Personalized financial intelligence</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {alerts.map((alert, index) => (
            <div key={index} className={`flex items-start space-x-4 p-4 rounded-xl border transition-luxury hover:shadow-elegant ${
              alert.type === 'success' ? 'bg-primary/5 border-primary/20' :
              alert.type === 'warning' ? 'bg-secondary/5 border-secondary/20' : 
              'bg-muted/30 border-border/40'
            }`}>
              <div className={`w-3 h-3 rounded-full mt-2 shadow-sm ${
                alert.type === 'success' ? 'bg-primary shadow-primary/30' :
                alert.type === 'warning' ? 'bg-secondary shadow-secondary/30' : 'bg-accent shadow-accent/30'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">{alert.time}</p>
                  <Badge variant="outline" className={`text-xs ${
                    (alert as any).priority === 'high' ? 'border-primary text-primary' :
                    (alert as any).priority === 'medium' ? 'border-secondary text-secondary' : 
                    'border-muted-foreground text-muted-foreground'
                  }`}>
                    {(alert as any).priority}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Luxury Analytics Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Income vs Expenses</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Monthly financial flow analysis</p>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl flex items-center justify-center border border-border/30">
              <div className="text-center space-y-2">
                <Sparkles className="h-8 w-8 text-primary mx-auto" />
                <p className="text-muted-foreground font-medium">Premium Chart Visualization</p>
                <p className="text-xs text-muted-foreground">Advanced analytics coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-secondary" />
              <span>Investment Portfolio</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Diversified asset allocation</p>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-gradient-to-br from-secondary/5 to-primary/5 rounded-xl flex items-center justify-center border border-border/30">
              <div className="text-center space-y-2">
                <Crown className="h-8 w-8 text-secondary mx-auto" />
                <p className="text-muted-foreground font-medium">Portfolio Breakdown</p>
                <p className="text-xs text-muted-foreground">Sophisticated asset analysis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};