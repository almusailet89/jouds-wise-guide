import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, message: 'Only POST supported' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
    const { data: auth, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !auth?.user) {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { amountSar, goalId, note } = body || {};

    if (typeof amountSar !== 'number' || Number.isNaN(amountSar)) {
      return new Response(JSON.stringify({ ok: false, message: 'amountSar (number) is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (amountSar <= 0) {
      return new Response(JSON.stringify({ ok: false, message: 'Amount must be greater than 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('record_savings_contribution', {
          _user_id: auth.user.id,
          _amount_sar: Number(amountSar),
          _goal_id: goalId ?? null,
          _note: note ?? null,
        });
      if (rpcError) {
        const msg = (rpcError as any)?.message || 'Failed to record contribution';
        const isFunds = msg.includes('INSUFFICIENT_FUNDS');
        const status = isFunds ? 409 : 400;
        return new Response(JSON.stringify({ ok: false, code: isFunds ? 'INSUFFICIENT_FUNDS' : 'ERROR', message: isFunds ? 'Insufficient funds' : msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const new_balance = rpcData && rpcData[0]?.new_balance as number | null;
      const contribution_id = rpcData && rpcData[0]?.contribution_id as string | null;

      let contribution = null;
      if (contribution_id) {
        const { data: row } = await supabase
          .from('savings_contributions')
          .select('*')
          .eq('id', contribution_id)
          .single();
        contribution = row;
      }

      return new Response(JSON.stringify({ ok: true, contribution, walletBalanceSar: new_balance }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = (e as any)?.message || 'Failed to record contribution';
      return new Response(JSON.stringify({ ok: false, message: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    console.error('savings-contribute error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as any)?.message || 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
