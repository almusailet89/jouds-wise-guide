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
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, symbol, quantity, price, currency } = await req.json();

    if (String(action).toUpperCase() !== 'BUY') {
      return new Response(JSON.stringify({ ok: false, message: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('record_portfolio_buy_with_wallet', {
      _user_id: user.id,
      _symbol: String(symbol),
      _quantity: Number(quantity),
      _price: Number(price),
      _currency: String(currency || 'SAR'),
    });

    if (rpcError) {
      const msg = (rpcError as any)?.message || 'Failed to execute buy';
      const isFunds = msg.includes('INSUFFICIENT_FUNDS');
      const status = isFunds ? 409 : 400;
      const payload = isFunds ? { ok: false, code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' } : { ok: false, message: msg };
      return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const holding_id = rpcData && rpcData[0]?.holding_id;
    const new_balance = rpcData && rpcData[0]?.new_balance;
    return new Response(JSON.stringify({ ok: true, holding_id, wallet: { balance: new_balance } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('portfolio-actions error:', error);
    return new Response(JSON.stringify({ ok: false, message: error?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
