import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from "lucide-react";
import { Insight } from '@/hooks/useFinancialDashboard';

interface InsightsPanelProps {
  insights: Insight[];
  loading?: boolean;
  onRefresh?: () => void;
  saver?: boolean;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ 
  insights, 
  loading = false, 
  onRefresh,
  saver = false,
}) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case 'drawdown':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'allocation':
        return <Sparkles className="h-4 w-4 text-secondary" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'performance':
        return 'bg-primary/10 border-primary/20 text-primary';
      case 'drawdown':
        return 'bg-destructive/10 border-destructive/20 text-destructive';
      case 'allocation':
        return 'bg-secondary/10 border-secondary/20 text-secondary';
      default:
        return 'bg-muted/50 border-border/50 text-muted-foreground';
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === 'performance' || type === 'drawdown') {
      return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    return value.toString();
  };

  return (
    <Card className="luxury-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="bg-gradient-secondary p-2 rounded-full">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-semibold">AI Insights</span>
              <p className="text-sm text-muted-foreground font-normal">Fact-based portfolio analysis</p>
            </div>
          </CardTitle>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading || saver}
              className="bg-white/10 border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {saver ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Insights paused in Egress Saver Mode</p>
            <p className="text-sm text-muted-foreground">Turn Saver off to enable, or use the main Refresh for prices/news only.</p>
          </div>
        ) : loading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex items-start space-x-4 p-4 rounded-xl border border-border/50">
                <div className="w-4 h-4 bg-muted rounded-full mt-1"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="w-16 h-6 bg-muted rounded"></div>
              </div>
            </div>
          ))
        ) : insights.length > 0 ? (
          insights.map((insight, index) => (
            <div 
              key={index} 
              className={`flex items-start space-x-4 p-4 rounded-xl border transition-all duration-300 hover:shadow-elegant ${getInsightColor(insight.type)}`}
            >
              <div className="mt-1">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {insight.message}
                  </p>
                  <Badge variant="outline" className="shrink-0">
                    {formatValue(insight.value, insight.type)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {insight.symbol} • {insight.timeframe}
                  </p>
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-background/50 text-foreground"
                  >
                    {insight.type}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No insights available</p>
            <p className="text-sm text-muted-foreground">
              Add portfolio holdings to get AI-powered insights
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};