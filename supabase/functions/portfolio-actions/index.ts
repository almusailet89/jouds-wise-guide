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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: auth } = await supabase.auth.getUser(token);
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, symbol, quantity, price, currency = 'USD' } = await req.json();
    const act = String(action || '').toUpperCase();
    const qty = Number(quantity);
    const prc = Number(price);
    if (!['BUY','SELL'].includes(act)) {
      return new Response(JSON.stringify({ ok: false, message: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!symbol || !qty || qty <= 0 || !prc || prc <= 0) {
      return new Response(JSON.stringify({ ok: false, message: 'symbol, quantity > 0, price > 0 required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sym = String(symbol).toUpperCase();
    const { data: existing } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', sym)
      .maybeSingle();

    if (act === 'BUY') {
      if (existing) {
        const newQty = Number(existing.quantity) + qty;
        const totalCost = Number(existing.avg_price) * Number(existing.quantity) + (qty * prc);
        const newAvg = totalCost / newQty;
        const { error: updErr } = await supabase
          .from('portfolio_holdings')
          .update({ quantity: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('user_id', user.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('portfolio_holdings')
          .insert({ user_id: user.id, asset_type: 'stock', symbol: sym, quantity: qty, avg_price: prc, currency, market: 'US', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (insErr) throw insErr;
      }
      // Optional: log investment
      await supabase.from('financial_data').insert({ user_id: user.id, type: 'investment', amount: qty * prc, currency, label: 'buy', category: 'portfolio', created_at: new Date().toISOString() });
      return new Response(JSON.stringify({ ok: true, action: 'BUY' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SELL
    if (!existing || Number(existing.quantity) < qty) {
      return new Response(JSON.stringify({ ok: false, message: 'Insufficient holding to sell' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    await supabase.from('financial_data').insert({ user_id: user.id, type: 'income', amount: qty * prc, currency, label: 'sell', category: 'portfolio', created_at: new Date().toISOString() });
    return new Response(JSON.stringify({ ok: true, action: 'SELL' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('portfolio-actions error:', error);
    return new Response(JSON.stringify({ ok: false, message: error?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
