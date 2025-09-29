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

    const { action, title, body, scheduled_at, task_id } = await req.json();
    const act = String(action || '').toLowerCase();

    if (act === 'enqueue') {
      if (!title || !scheduled_at) {
        return new Response(JSON.stringify({ ok: false, message: 'title and scheduled_at required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data, error } = await supabase.from('scheduled_notifications').insert({
        user_id: user.id,
        task_id: task_id || null,
        title,
        body: body || null,
        scheduled_at,
      }).select().single();
      if (error) {
        return new Response(JSON.stringify({ ok: false, message: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true, notification: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (act === 'digest') {
      // Fetch pending notifications due for this user
      const nowIso = new Date().toISOString();
      const { data: pending, error } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .lte('scheduled_at', nowIso);
      if (error) {
        return new Response(JSON.stringify({ ok: false, message: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Mark as sent
      if (pending && pending.length > 0) {
        const ids = pending.map((p: any) => p.id);
        const { error: updErr } = await supabase
          .from('scheduled_notifications')
          .update({ status: 'sent' })
          .in('id', ids);
        if (updErr) {
          return new Response(JSON.stringify({ ok: false, message: updErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ ok: true, sent: pending?.length || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false, message: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('tasks-actions error:', e);
    return new Response(JSON.stringify({ ok: false, message: e?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
