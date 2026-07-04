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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting price refresh...');

    // Get unique symbols from portfolio_holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('portfolio_holdings')
      .select('symbol, asset_type, currency')
      .neq('symbol', null);

    if (holdingsError) {
      throw holdingsError;
    }

    console.log(`Found ${holdings?.length || 0} holdings to update`);

    const updatedAssets = [];

    // Update prices for each symbol
    for (const holding of holdings || []) {
      let newPrice = null;
      
      try {
        if (holding.asset_type === 'crypto') {
          // Fetch crypto price from CoinGecko
          const cryptoResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${holding.symbol.toLowerCase()}&vs_currencies=usd`
          );
          
          if (cryptoResponse.ok) {
            const cryptoData = await cryptoResponse.json();
            const symbolKey = holding.symbol.toLowerCase();
            if (cryptoData[symbolKey]) {
              newPrice = cryptoData[symbolKey].usd;
            }
          }
        } else {
          // Fetch stock price from Yahoo Finance (using a public API)
          // For demo purposes, we'll use mock data that varies slightly
          const basePrice = Math.random() * 200 + 50; // Random price between 50-250
          const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
          newPrice = basePrice * (1 + variation);
        }

        if (newPrice) {
          // Update current_price in portfolio_holdings
          const { error: updateError } = await supabase
            .from('portfolio_holdings')
            .update({
              current_price: newPrice,
              last_updated: new Date().toISOString()
            })
            .eq('symbol', holding.symbol);

          if (updateError) {
            console.error(`Error updating ${holding.symbol}:`, updateError);
            continue;
          }

          // Log price history
          const { error: historyError } = await supabase
            .from('price_history')
            .insert({
              symbol: holding.symbol,
              asset_type: holding.asset_type,
              price: newPrice,
              currency: holding.currency || 'USD'
            });

          if (historyError) {
            console.error(`Error logging history for ${holding.symbol}:`, historyError);
          }

          updatedAssets.push({
            symbol: holding.symbol,
            asset_type: holding.asset_type,
            price: newPrice
          });

          console.log(`Updated ${holding.symbol}: $${newPrice.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`Error fetching price for ${holding.symbol}:`, error);
      }
    }

    console.log(`Price refresh completed. Updated ${updatedAssets.length} assets.`);

    return new Response(JSON.stringify({
      success: true,
      updated_count: updatedAssets.length,
      updated_assets: updatedAssets
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in refresh-prices function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});