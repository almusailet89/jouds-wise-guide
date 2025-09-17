import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  published_at: string;
  symbol?: string;
}

interface NewsPanelProps {
  news: Record<string, NewsItem[]>;
  loading?: boolean;
  onRefresh?: () => void;
}

export const NewsPanel: React.FC<NewsPanelProps> = ({ 
  news, 
  loading = false, 
  onRefresh 
}) => {
  // Flatten and sort news by published date
  const allNews = Object.entries(news)
    .flatMap(([symbol, articles]) => 
      articles.map(article => ({ ...article, symbol }))
    )
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 10); // Show latest 10 articles

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const truncateTitle = (title: string, maxLength: number = 80) => {
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };

  return (
    <Card className="luxury-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="bg-gradient-primary p-2 rounded-full">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-semibold">Market News</span>
              <p className="text-sm text-muted-foreground font-normal">Latest financial headlines</p>
            </div>
          </CardTitle>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="bg-white/10 border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex items-start space-x-4 p-3 border border-border/30 rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
                <div className="w-6 h-6 bg-muted rounded"></div>
              </div>
            </div>
          ))
        ) : allNews.length > 0 ? (
          allNews.map((article, index) => (
            <div 
              key={index}
              className="group flex items-start justify-between p-3 border border-border/30 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground leading-snug mb-1">
                  {truncateTitle(article.title)}
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {article.source}
                  </Badge>
                  {article.symbol && (
                    <Badge variant="secondary" className="text-xs">
                      {article.symbol}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(article.published_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 ml-2 opacity-60 group-hover:opacity-100 transition-opacity"
                onClick={() => window.open(article.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Newspaper className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No news available</p>
            <p className="text-sm text-muted-foreground">
              News will appear when you add portfolio holdings
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};