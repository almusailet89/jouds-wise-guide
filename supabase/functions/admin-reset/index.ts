import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reset-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, message: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminKeyHeader = req.headers.get('x-reset-key') || '';
    const ADMIN_KEY = Deno.env.get('DEV_RESET_KEY') || '';
    if (!ADMIN_KEY || adminKeyHeader !== ADMIN_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Execute privileged reset via RPC (created by migration)
    const { error } = await supabase.rpc('reset_dev_data_seed', { _seed: 0 });
    if (error) {
      console.error('reset_dev_data error:', error);
      return new Response(JSON.stringify({ ok: false, message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('admin-reset error:', err);
    return new Response(JSON.stringify({ ok: false, message: err?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
