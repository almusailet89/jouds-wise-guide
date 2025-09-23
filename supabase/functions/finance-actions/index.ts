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

    // Create client that forwards the user's Authorization header in all requests (RLS)
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

    const { body } = await req.json();
    const { type, amount, currency, category, description, occurred_at } = body || {};
    if (!type || typeof amount !== 'number' || !currency) {
      return new Response(JSON.stringify({ ok: false, message: 'type, amount, currency are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (amount <= 0) {
      return new Response(JSON.stringify({ ok: false, message: 'Amount must be greater than 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Guardrails via RPC (atomic wallet update + entry insert)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('record_financial_with_wallet', {
          _user_id: auth.user.id,
          _type: String(type),
          _amount: Number(amount),
          _currency: String(currency || 'SAR'),
          _category: category ?? null,
          _description: description ?? null,
          _occurred_at: occurred_at || new Date().toISOString(),
        });
      if (rpcError) {
        const msg = (rpcError as any)?.message || 'Failed to apply transaction';
        const isFunds = msg.includes('INSUFFICIENT_BALANCE') || msg.includes('INSUFFICIENT_FUNDS');
        const status = isFunds ? 409 : 400;
        const payload = isFunds ? { ok: false, code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' } : { ok: false, message: msg };
        return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Optionally fetch the inserted entry by id
      let entry = null;
      const id = rpcData && rpcData[0]?.entry_id;
      if (id) {
        const { data: entryRow } = await supabase.from('financial_entries').select('*').eq('id', id as string).single();
        entry = entryRow;
      }
      const new_balance = rpcData && rpcData[0]?.new_balance;
      return new Response(JSON.stringify({ ok: true, data: entry, wallet: { balance: new_balance } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = (e as any)?.message || 'Failed to apply transaction';
      return new Response(JSON.stringify({ ok: false, message: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    console.error('finance-actions error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as any)?.message || 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
