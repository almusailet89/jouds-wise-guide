import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, AlertCircle } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, trend }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <div className={`text-xs flex items-center mt-1 ${
        trend === 'up' ? 'text-green-600' : 
        trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
      }`}>
        {trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
        {change}
      </div>
    </CardContent>
  </Card>
);

export const FinancialDashboard: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'ytd'>('30d');

  const kpis = [
    {
      title: "Monthly Income",
      value: "SR 15,000",
      change: "+12% from last month",
      icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
      trend: 'up' as const
    },
    {
      title: "Monthly Expenses",
      value: "SR 8,500",
      change: "-5% from last month",
      icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />,
      trend: 'down' as const
    },
    {
      title: "Total Savings",
      value: "SR 45,000",
      change: "+8% this month",
      icon: <PiggyBank className="h-4 w-4 text-muted-foreground" />,
      trend: 'up' as const
    },
    {
      title: "Investments",
      value: "SR 25,000",
      change: "+15% this month",
      icon: <Target className="h-4 w-4 text-muted-foreground" />,
      trend: 'up' as const
    }
  ];

  const alerts = [
    {
      type: 'success',
      message: "ARAMCO stock is up 10% - consider selling",
      time: "2 hours ago"
    },
    {
      type: 'warning',
      message: "High spending detected in entertainment category",
      time: "1 day ago"
    },
    {
      type: 'info',
      message: "Monthly savings target achieved! 🎉",
      time: "3 days ago"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Time Filter */}
      <div className="flex space-x-2">
        {(['7d', '30d', 'ytd'] as const).map((filter) => (
          <Button
            key={filter}
            variant={timeFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter(filter)}
          >
            {filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : 'Year to Date'}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Savings Target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Monthly Savings Target</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: SR 6,500 / SR 8,000</span>
              <span className="font-semibold">81%</span>
            </div>
            <Progress value={81} className="h-3" />
            <p className="text-xs text-muted-foreground">
              You're on track! SR 1,500 more to reach your goal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Smart Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Smart Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((alert, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
              <div className={`w-2 h-2 rounded-full mt-2 ${
                alert.type === 'success' ? 'bg-green-500' :
                alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1">
                <p className="text-sm">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart visualization here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investment Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Portfolio breakdown here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};