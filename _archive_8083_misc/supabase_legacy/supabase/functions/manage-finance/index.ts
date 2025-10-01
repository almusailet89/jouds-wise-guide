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
        const { range } = body || {};
        
        let query = supabase
          .from('financial_data')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        // Apply date range filter
        if (range) {
          const now = new Date();
          let startDate;
          
          switch (range) {
            case '7d':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case '30d':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
            case 'ytd':
              startDate = new Date(now.getFullYear(), 0, 1);
              break;
            default:
              break;
          }
          
          if (startDate) {
            query = query.gte('date', startDate.toISOString());
          }
        }

        const { data, error } = await query;
        
        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const { type, amount, currency, category, description, date } = body;

        if (!type || !amount) {
          throw new Error('Type and amount are required');
        }

        const { data, error } = await supabase
          .from('financial_data')
          .insert({
            user_id: user.id,
            type,
            amount: parseFloat(amount),
            currency: currency || 'SAR',
            category: category || 'general',
            label: category || 'general', // Required field
            note: description || '',
            description: description || '',
            date: date || new Date().toISOString()
          })
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

        const { data, error } = await supabase
          .from('financial_data')
          .update(updates)
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
          .from('financial_data')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid method');
    }

  } catch (error) {
    console.error('Error in manage-finance function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});