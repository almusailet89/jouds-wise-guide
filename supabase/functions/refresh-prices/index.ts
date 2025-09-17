import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all unique stock and crypto symbols from portfolio holdings
    const { data: holdings, error } = await supabase
      .from('portfolio_holdings')
      .select('symbol, asset_type')
      .in('asset_type', ['stock', 'crypto']);

    if (error) throw error;

    const stockSymbols = [...new Set(holdings?.filter(h => h.asset_type === 'stock').map(h => h.symbol) || [])];
    const cryptoSymbols = [...new Set(holdings?.filter(h => h.asset_type === 'crypto').map(h => h.symbol) || [])];

    // Update stock prices (using Alpha Vantage or mock data for now)
    for (const symbol of stockSymbols) {
      // Mock price update - in production, use real API
      const mockPrice = 100 + Math.random() * 200;
      
      await supabase
        .from('portfolio_holdings')
        .update({ 
          current_price: mockPrice,
          last_updated: new Date().toISOString()
        })
        .eq('symbol', symbol)
        .eq('asset_type', 'stock');

      // Store in price history
      await supabase
        .from('price_history')
        .insert({
          symbol,
          asset_type: 'stock',
          price: mockPrice,
          currency: 'USD'
        });
    }

    // Update crypto prices (using CoinGecko or mock data for now)  
    for (const symbol of cryptoSymbols) {
      // Mock price update - in production, use real API
      const mockPrice = 1000 + Math.random() * 50000;
      
      await supabase
        .from('portfolio_holdings')
        .update({ 
          current_price: mockPrice,
          last_updated: new Date().toISOString()
        })
        .eq('symbol', symbol)
        .eq('asset_type', 'crypto');

      // Store in price history
      await supabase
        .from('price_history')
        .insert({
          symbol,
          asset_type: 'crypto',
          price: mockPrice,
          currency: 'USD'
        });
    }

    return new Response(JSON.stringify({ 
      success: true,
      updated_stocks: stockSymbols.length,
      updated_crypto: cryptoSymbols.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error refreshing prices:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});