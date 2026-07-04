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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Fetch portfolio holdings with current prices
    const { data: holdings, error: holdingsError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id);

    if (holdingsError) throw holdingsError;

    // Fetch recent price history for trend analysis
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const insights = [];

    for (const holding of holdings || []) {
      if (!holding.symbol) continue;

      // Get price history for this symbol
      const { data: priceHistory, error: historyError } = await supabase
        .from('price_history')
        .select('price, timestamp')
        .eq('symbol', holding.symbol)
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (historyError) {
        console.error(`Error fetching history for ${holding.symbol}:`, historyError);
        continue;
      }

      if (!priceHistory || priceHistory.length === 0) continue;

      const currentPrice = holding.current_price || holding.avg_price;
      const oldestPrice = priceHistory[0]?.price;
      const recentPrices = priceHistory.filter(p => 
        new Date(p.timestamp) > sevenDaysAgo
      );

      // Calculate performance metrics
      const monthlyChange = oldestPrice ? 
        ((currentPrice - oldestPrice) / oldestPrice * 100) : 0;

      const weeklyPrices = recentPrices.map(p => p.price);
      const weeklyHigh = Math.max(...weeklyPrices, currentPrice);
      const weeklyLow = Math.min(...weeklyPrices, currentPrice);
      const weeklyAvg = weeklyPrices.length > 0 ? 
        weeklyPrices.reduce((a, b) => a + b, 0) / weeklyPrices.length : currentPrice;

      // Calculate portfolio allocation
      const totalValue = holdings.reduce((sum, h) => {
        const price = h.current_price || h.avg_price || 0;
        const qty = h.quantity || 1;
        return sum + (price * qty);
      }, 0);

      const holdingValue = currentPrice * (holding.quantity || 1);
      const allocation = totalValue > 0 ? (holdingValue / totalValue * 100) : 0;

      // Generate fact-only insights
      if (Math.abs(monthlyChange) > 5) {
        const direction = monthlyChange > 0 ? '+' : '';
        const comparison = currentPrice > weeklyAvg ? 
          `${((currentPrice - weeklyAvg) / weeklyAvg * 100).toFixed(1)}% above` :
          `${((weeklyAvg - currentPrice) / weeklyAvg * 100).toFixed(1)}% below`;

        insights.push({
          type: 'performance',
          symbol: holding.symbol,
          message: `${holding.symbol} ${direction}${monthlyChange.toFixed(1)}% this month; currently ${comparison} 7-day average.`,
          value: monthlyChange,
          timeframe: 'monthly'
        });
      }

      // Drawdown analysis
      if (weeklyPrices.length > 0) {
        const maxDrawdown = ((weeklyHigh - weeklyLow) / weeklyHigh * 100);
        if (maxDrawdown > 5) {
          const fromPeak = ((weeklyHigh - currentPrice) / weeklyHigh * 100);
          insights.push({
            type: 'drawdown',
            symbol: holding.symbol,
            message: `${holding.symbol} weekly drawdown −${maxDrawdown.toFixed(1)}%; currently ${fromPeak.toFixed(1)}% below 7-day high.`,
            value: -maxDrawdown,
            timeframe: 'weekly'
          });
        }
      }

      // Top holding analysis
      if (allocation > 15) {
        insights.push({
          type: 'allocation',
          symbol: holding.symbol,
          message: `Top holding: ${holding.symbol} (${allocation.toFixed(1)}% of portfolio allocation).`,
          value: allocation,
          timeframe: 'current'
        });
      }
    }

    // Financial data insights
    const { data: financialData, error: finError } = await supabase
      .from('financial_data')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString());

    if (!finError && financialData) {
      const monthlyIncome = financialData
        .filter(d => d.type === 'income')
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);

      const monthlyExpenses = financialData
        .filter(d => d.type === 'expense')
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);

      if (monthlyIncome > 0 && monthlyExpenses > 0) {
        const savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100);
        insights.push({
          type: 'savings',
          symbol: 'CASH',
          message: `Monthly savings rate: ${savingsRate.toFixed(1)}% (${monthlyIncome.toFixed(0)} income, ${monthlyExpenses.toFixed(0)} expenses).`,
          value: savingsRate,
          timeframe: 'monthly'
        });
      }
    }

    // Sort insights by importance (highest absolute values first)
    insights.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    return new Response(JSON.stringify({ 
      insights: insights.slice(0, 10) // Limit to top 10 insights
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-financial-insights function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      insights: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});