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
    const action = String(body?.action || '').toLowerCase();

    if (action !== 'create_task') {
      return new Response(JSON.stringify({ ok: false, message: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const title = String(body?.title || '').trim();
    const due_at = String(body?.due_at || '').trim();
    const reminder_at = body?.reminder_at ? String(body.reminder_at).trim() : null;
    const note = body?.note ? String(body.note).trim() : null;

    if (!title) {
      return new Response(JSON.stringify({ ok: false, message: 'Title is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const dueEpoch = Date.parse(due_at);
    if (!due_at || Number.isNaN(dueEpoch)) {
      return new Response(JSON.stringify({ ok: false, message: 'Valid due_at ISO datetime is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (reminder_at) {
      const rEpoch = Date.parse(reminder_at);
      if (Number.isNaN(rEpoch)) {
        return new Response(JSON.stringify({ ok: false, message: 'Invalid reminder_at datetime' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Insert into tasks table (map due_at -> due_date, reminder_at as is if present)
    const { data: row, error } = await supabase
      .from('tasks')
      .insert({
        user_id: auth.user.id,
        title,
        description: note,
        status: 'pending',
        priority: 'medium',
        category: 'reminder',
        due_date: due_at,
        reminder_at: reminder_at,
      })
      .select('id, title, due_date, reminder_at')
      .single();

    if (error) {
      return new Response(JSON.stringify({ ok: false, message: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const task = { id: row.id, title: row.title, due_at: row.due_date, reminder_at: row.reminder_at };
    return new Response(JSON.stringify({ ok: true, task }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('tasks-actions error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as any)?.message || 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
