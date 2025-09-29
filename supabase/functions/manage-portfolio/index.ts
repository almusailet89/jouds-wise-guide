import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user token for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { method, body } = await req.json();

    switch (method) {
      case 'GET': {
        const { data, error } = await supabase
          .from('portfolio_holdings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const { 
          asset_type, 
          symbol, 
          quantity, 
          avg_price, 
          currency, 
          purchase_date,
          address,
          property_type,
          sqft,
          purchase_price 
        } = body;

        // Validate asset type
        if (!asset_type || !['stock', 'crypto', 'real_estate'].includes(asset_type)) {
          return new Response(JSON.stringify({ error: 'Valid asset_type (stock/crypto/real_estate) is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check maximum holdings limit (25)
        const { count } = await supabase
          .from('portfolio_holdings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (count && count >= 25) {
          return new Response(JSON.stringify({ error: 'Maximum of 25 holdings allowed per user' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Validate based on asset type
        if (asset_type === 'real_estate') {
          if (!address) {
            return new Response(JSON.stringify({ error: 'Address is required for real estate' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (!purchase_price || parseFloat(purchase_price) <= 0) {
            return new Response(JSON.stringify({ error: 'Purchase price must be greater than 0 for real estate' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          if (!symbol) {
            return new Response(JSON.stringify({ error: 'Symbol is required for stocks and crypto' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (!quantity || parseFloat(quantity) <= 0) {
            return new Response(JSON.stringify({ error: 'Quantity must be greater than 0 for stocks and crypto' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (!avg_price || parseFloat(avg_price) <= 0) {
            return new Response(JSON.stringify({ error: 'Average price must be greater than 0 for stocks and crypto' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const holdingData: any = {
          user_id: user.id,
          asset_type,
          currency: currency || 'USD',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (asset_type === 'real_estate') {
          holdingData.address = address;
          holdingData.property_type = property_type || 'residential';
          holdingData.sqft = sqft ? parseFloat(sqft) : null;
          holdingData.purchase_price = parseFloat(purchase_price);
          // Required fields for database
          holdingData.symbol = address;
          holdingData.market = 'Real Estate';
          holdingData.quantity = 1;
          holdingData.avg_price = parseFloat(purchase_price);
        } else {
          holdingData.symbol = symbol.toUpperCase();
          holdingData.quantity = parseFloat(quantity);
          holdingData.avg_price = parseFloat(avg_price);
          holdingData.is_crypto = asset_type === 'crypto';
          holdingData.market = asset_type === 'crypto' ? 'Crypto' : 'US';
        }

        if (purchase_date) {
          holdingData.created_at = purchase_date;
        }

        const { data, error } = await supabase
          .from('portfolio_holdings')
          .insert(holdingData)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        const { id, updates } = body;

        if (!id) {
          return new Response(JSON.stringify({ error: 'ID is required for updates' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Validate updates
        if (updates.quantity !== undefined && parseFloat(updates.quantity) <= 0) {
          return new Response(JSON.stringify({ error: 'Quantity must be greater than 0' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (updates.avg_price !== undefined && parseFloat(updates.avg_price) <= 0) {
          return new Response(JSON.stringify({ error: 'Average price must be greater than 0' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData = {
          ...updates,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('portfolio_holdings')
          .update(updateData)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        const { id } = body;

        if (!id) {
          return new Response(JSON.stringify({ error: 'ID is required for deletion' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('portfolio_holdings')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'SELL': {
        const { symbol, quantity, price, currency = 'USD' } = body || {};
        if (!symbol || !quantity || !price) {
          return new Response(JSON.stringify({ error: 'symbol, quantity, price are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const sym = String(symbol).toUpperCase();
        const qty = Number(quantity);
        const prc = Number(price);
        if (qty <= 0 || prc <= 0) {
          return new Response(JSON.stringify({ error: 'quantity and price must be > 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: existing, error: exErr } = await supabase
          .from('portfolio_holdings')
          .select('*')
          .eq('user_id', user.id)
          .eq('symbol', sym)
          .maybeSingle();
        if (exErr) throw exErr;
        if (!existing || Number(existing.quantity) < qty) {
          return new Response(JSON.stringify({ error: 'Insufficient holding to sell' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const remaining = Number(existing.quantity) - qty;
        if (remaining > 0) {
          const { error: updErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: remaining, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .eq('user_id', user.id);
          if (updErr) throw updErr;
        } else {
          const { error: delErr } = await supabase
            .from('portfolio_holdings')
            .delete()
            .eq('id', existing.id)
            .eq('user_id', user.id);
          if (delErr) throw delErr;
        }
        // Credit proceeds into wallet via income log
        const proceeds = qty * prc;
        const { error: finErr } = await supabase.from('financial_data').insert({
          user_id: user.id,
          type: 'income',
          amount: proceeds,
          currency,
          label: 'sell',
          category: 'portfolio',
          created_at: new Date().toISOString(),
        });
        if (finErr) throw finErr;
        return new Response(JSON.stringify({ success: true, action: 'SELL', proceeds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'SUMMARY': {
        // Get portfolio summary using the database function
        const { data, error } = await supabase
          .rpc('get_portfolio_summary', { user_uuid: user.id });

        if (error) throw error;

        return new Response(JSON.stringify({ data: data[0] || {} }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid method' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error in manage-portfolio function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});