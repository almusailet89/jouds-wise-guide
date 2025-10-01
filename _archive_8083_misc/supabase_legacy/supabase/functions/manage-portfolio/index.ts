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

        if (!asset_type) {
          throw new Error('Asset type is required');
        }

        // Check maximum holdings limit (25)
        const { count } = await supabase
          .from('portfolio_holdings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (count && count >= 25) {
          throw new Error('Maximum of 25 holdings allowed per user');
        }

        // Validate required fields based on asset type
        if (asset_type === 'real_estate') {
          if (!address) {
            throw new Error('Address is required for real estate');
          }
        } else {
          if (!symbol) {
            throw new Error('Symbol is required for stocks and crypto');
          }
          if (!quantity || quantity <= 0) {
            throw new Error('Valid quantity is required for stocks and crypto');
          }
          if (!avg_price || avg_price <= 0) {
            throw new Error('Valid average price is required for stocks and crypto');
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
          holdingData.purchase_price = purchase_price ? parseFloat(purchase_price) : null;
          // Required fields for database
          holdingData.symbol = address;
          holdingData.market = 'Real Estate';
          holdingData.quantity = 1;
          holdingData.avg_price = purchase_price ? parseFloat(purchase_price) : 1;
        } else {
          holdingData.symbol = symbol;
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
          throw new Error('ID is required for updates');
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
          throw new Error('ID is required for deletion');
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
        throw new Error('Invalid method');
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