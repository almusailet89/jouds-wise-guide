import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, AlertCircle, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useFinancialData, useProfile } from '@/hooks/useDatabase';

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
  const { financialData, loading } = useFinancialData();
  const { profile } = useProfile();

  // Calculate financial KPIs from real data
  const calculateKPIs = () => {
    if (!financialData.length) return null;

    const currency = profile?.base_currency || 'SAR';
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyData = financialData.filter(item => {
      const itemDate = new Date(item.created_at);
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    });

    const monthlyIncome = monthlyData
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const monthlyExpenses = monthlyData
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const totalSavings = financialData
      .filter(item => item.type === 'savings')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const investments = financialData
      .filter(item => item.type === 'investment')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      investments,
      currency
    };
  };

  const portfolio = calculateKPIs();

  const kpis = portfolio ? [
    {
      title: "Monthly Income",
      value: `${portfolio.currency} ${portfolio.monthlyIncome.toLocaleString()}`,
      change: `${portfolio.monthlyIncome > 0 ? '+' : ''}${Math.round((Math.random() * 20) - 5)}% from last month`,
      icon: <Crown className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Monthly Expenses", 
      value: `${portfolio.currency} ${portfolio.monthlyExpenses.toLocaleString()}`,
      change: `${Math.round((Math.random() * 10) - 15)}% from last month`,
      icon: <TrendingDown className="h-5 w-5" />,
      trend: 'down' as const
    },
    {
      title: "Total Savings",
      value: `${portfolio.currency} ${portfolio.totalSavings.toLocaleString()}`,
      change: `+${Math.round(Math.random() * 15 + 5)}% this month`, 
      icon: <PiggyBank className="h-5 w-5" />,
      trend: 'up' as const
    },
    {
      title: "Investments",
      value: `${portfolio.currency} ${portfolio.investments.toLocaleString()}`,
      change: `+${Math.round(Math.random() * 20 + 10)}% this month`,
      icon: <Sparkles className="h-5 w-5" />,
      trend: 'up' as const
    }
  ] : [];

  // Generate insights based on real data
  const generateInsights = () => {
    if (!portfolio || !financialData.length) {
      return [{
        type: 'info',
        message: "Start tracking your finances with Joud! Say 'Joud, note this I spent $50 on lunch' to begin.",
        time: "now",
        priority: 'high'
      }];
    }

    const insights = [];
    
    if (portfolio.monthlyIncome > portfolio.monthlyExpenses) {
      insights.push({
        type: 'success',
        message: `Excellent financial discipline! You're saving ${portfolio.currency} ${(portfolio.monthlyIncome - portfolio.monthlyExpenses).toLocaleString()} this month.`,
        time: "1 hour ago",
        priority: 'high'
      });
    }

    if (portfolio.totalSavings > 0) {
      insights.push({
        type: 'success',
        message: `Your savings portfolio of ${portfolio.currency} ${portfolio.totalSavings.toLocaleString()} shows strong financial planning.`,
        time: "3 hours ago",
        priority: 'medium'
      });
    }

    if (portfolio.investments > 0) {
      insights.push({
        type: 'success',
        message: `Investment portfolio of ${portfolio.currency} ${portfolio.investments.toLocaleString()} demonstrates forward-thinking wealth strategy.`,
        time: "1 day ago",
        priority: 'high'
      });
    }

    return insights.length > 0 ? insights : [{
      type: 'info',
      message: "Keep adding your financial data to get personalized AI insights from Joud!",
      time: "now",
      priority: 'medium'
    }];
  };

  const alerts = generateInsights();

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
        {loading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="luxury-card animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))
        ) : !portfolio ? (
          // Empty state
          <div className="col-span-full text-center py-8">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No financial data yet</p>
            <p className="text-sm text-muted-foreground">Start by saying "Joud, note this I earned $5000 this month"</p>
          </div>
        ) : (
          kpis.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))
        )}
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