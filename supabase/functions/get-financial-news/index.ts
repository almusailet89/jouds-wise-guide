import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols)) {
      throw new Error('Symbols array is required');
    }

    const news = [];

    // Check cache first for recent news (within last 4 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const { data: cachedNews } = await supabase
      .from('news_cache')
      .select('*')
      .in('symbol', symbols)
      .gte('fetched_at', fourHoursAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(3 * symbols.length);

    const cachedSymbols = new Set(cachedNews?.map(n => n.symbol) || []);
    const symbolsToFetch = symbols.filter(s => !cachedSymbols.has(s));

    // Fetch fresh news for symbols not in cache
    for (const symbol of symbolsToFetch) {
      try {
        // For demo purposes, we'll create mock news data
        // In a real implementation, you'd use APIs like NewsAPI, Alpha Vantage, or Financial Modeling Prep
        const mockNews = [
          {
            symbol,
            title: `${symbol} Reports Strong Quarterly Earnings`,
            source: 'Financial Times',
            url: `https://example.com/news/${symbol.toLowerCase()}-earnings`,
            published_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
            content: `${symbol} announced strong quarterly results with revenue growth exceeding expectations.`
          },
          {
            symbol,
            title: `Market Analysis: ${symbol} Shows Positive Momentum`,
            source: 'Reuters',
            url: `https://example.com/news/${symbol.toLowerCase()}-analysis`,
            published_at: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000).toISOString(),
            content: `Technical analysis suggests ${symbol} is showing positive momentum in recent trading sessions.`
          },
          {
            symbol,
            title: `${symbol} Announces Strategic Partnership`,
            source: 'Bloomberg',
            url: `https://example.com/news/${symbol.toLowerCase()}-partnership`,
            published_at: new Date(Date.now() - Math.random() * 72 * 60 * 60 * 1000).toISOString(),
            content: `${symbol} has announced a new strategic partnership to expand its market presence.`
          }
        ];

        // Store in cache
        for (const article of mockNews) {
          const { error } = await supabase
            .from('news_cache')
            .insert({
              ...article,
              fetched_at: new Date().toISOString()
            });

          if (!error) {
            news.push(article);
          }
        }

      } catch (error) {
        console.error(`Error fetching news for ${symbol}:`, error);
      }
    }

    // Add cached news to results
    if (cachedNews) {
      news.push(...cachedNews.map(item => ({
        symbol: item.symbol,
        title: item.title,
        source: item.source,
        url: item.url,
        published_at: item.published_at,
        content: item.content
      })));
    }

    // Group by symbol and limit to 3 per symbol
    const groupedNews = symbols.reduce((acc, symbol) => {
      acc[symbol] = news
        .filter(n => n.symbol === symbol)
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, 3);
      return acc;
    }, {} as Record<string, any[]>);

    return new Response(JSON.stringify({ 
      news: groupedNews 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-financial-news function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      news: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});