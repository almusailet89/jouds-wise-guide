import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, message: "Only POST supported" }, { status: 405 });
    }

    const { method = "POST", resource, body } = await req.json().catch(() => ({}));
    if (!resource) return jsonResponse({ ok: false, message: "Missing resource" }, { status: 400 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ ok: false, message: "Missing server env" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const upperMethod = String(method || 'POST').toUpperCase();

    // Helpers
    async function insertOrFallback<T>(table: string, primary: Record<string, unknown>, fallback?: Record<string, unknown>) {
      // First attempt
      let { data, error } = await supabaseAdmin.from(table).insert(primary).select().single();
      if (!error) return { data, error: null } as { data: T; error: null };
      // On column mismatch, try fallback if provided
      const msg = String(error?.message || "");
      if (fallback && (error?.code === "42703" || msg.includes("column") || msg.includes("does not exist"))) {
        const res2 = await supabaseAdmin.from(table).insert(fallback).select().single();
        return { data: res2.data as T, error: res2.error };
      }
      return { data: data as T, error };
    }

    switch (String(resource)) {
      case "task": {
        if (upperMethod !== 'POST') return jsonResponse({ ok: false, message: 'Unsupported method' }, { status: 405 });
        const args = body || {};
        const primary = {
          user_id: userId,
          title: String(args.title || "Untitled"),
          due_date: args.due_date ?? null,
          priority: args.priority || "medium",
          description: args.notes ?? null,
          status: "pending",
        };
        const { data, error } = await supabaseAdmin.from("tasks").insert(primary).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, data });
      }

      case "mood": {
        if (upperMethod !== 'POST') return jsonResponse({ ok: false, message: 'Unsupported method' }, { status: 405 });
        const args = body || {};
        const payload = {
          user_id: userId,
          mood_score: Number(args.score ?? 0),
          mood_label: args.mood ?? null,
          note: args.notes ?? null,
          logged_at: args.occurred_at ?? new Date().toISOString(),
        };
        const { data, error } = await supabaseAdmin.from("mood_logs").insert(payload).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, data });
      }

      case "goal": {
        const args = body || {};
        if (upperMethod === 'POST') {
          // Try new schema first (target_date, amount_target, notes)
          const primary = {
            user_id: userId,
            title: String(args.title || "Untitled goal"),
            notes: args.notes ?? null,
            target_date: args.target_date ?? null,
            amount_target: args.amount_target ?? null,
            status: "active",
          } as any;
          const fallback = {
            user_id: userId,
            title: String(args.title || "Untitled goal"),
            due_date: args.target_date ?? args.due_date ?? null,
            target_amount: args.amount_target ?? args.target_amount ?? null,
            status: "active",
          } as any;
          const { data, error } = await insertOrFallback<any>("goals", primary, fallback);
          if (error) throw error;
          return jsonResponse({ ok: true, data });
        } else if (upperMethod === 'PUT') {
          const id = args.id;
          if (!id) return jsonResponse({ ok: false, message: 'id is required' }, { status: 400 });
          const updates: any = {};
          if (typeof args.title === 'string') updates.title = args.title;
          if (typeof args.notes !== 'undefined') updates.notes = args.notes;
          if (typeof args.target_date !== 'undefined') updates.target_date = args.target_date;
          if (typeof args.amount_target !== 'undefined') updates.amount_target = args.amount_target;
          if (typeof args.due_date !== 'undefined') updates.due_date = args.due_date;
          if (typeof args.target_amount !== 'undefined') updates.target_amount = args.target_amount;
          const { data, error } = await supabaseAdmin.from('goals').update(updates).eq('id', id).eq('user_id', userId).select().single();
          if (error) throw error;
          return jsonResponse({ ok: true, data });
        } else if (upperMethod === 'DELETE') {
          const id = args.id;
          if (!id) return jsonResponse({ ok: false, message: 'id is required' }, { status: 400 });
          const { error } = await supabaseAdmin.from('goals').delete().eq('id', id).eq('user_id', userId);
          if (error) throw error;
          return jsonResponse({ ok: true });
        } else {
          return jsonResponse({ ok: false, message: 'Unsupported method' }, { status: 405 });
        }
      }

      case "knowledge": {
        const args = body || {};
        if (upperMethod === 'POST') {
          const primary = {
            user_id: userId,
            title: String(args.title || "Untitled"),
            content: String(args.content || ""),
            tags: Array.isArray(args.tags) ? args.tags : [],
            source: args.source ?? null,
          };
          const fallback = {
            user_id: userId,
            title: String(args.title || "Untitled"),
            content: String(args.content || ""),
            tags: Array.isArray(args.tags) ? args.tags : [],
          };
          const { data, error } = await insertOrFallback<any>("knowledge_vault", primary, fallback);
          if (error) throw error;
          return jsonResponse({ ok: true, data });
        } else if (upperMethod === 'PUT') {
          const id = args.id;
          if (!id) return jsonResponse({ ok: false, message: 'id is required' }, { status: 400 });
          const updates: any = {};
          if (typeof args.title === 'string') updates.title = args.title;
          if (typeof args.content === 'string') updates.content = args.content;
          if (Array.isArray(args.tags)) updates.tags = args.tags;
          if (typeof args.source !== 'undefined') updates.source = args.source;
          const { data, error } = await supabaseAdmin.from('knowledge_vault').update(updates).eq('id', id).eq('user_id', userId).select().single();
          if (error) throw error;
          return jsonResponse({ ok: true, data });
        } else if (upperMethod === 'DELETE') {
          const id = args.id;
          if (!id) return jsonResponse({ ok: false, message: 'id is required' }, { status: 400 });
          const { error } = await supabaseAdmin.from('knowledge_vault').delete().eq('id', id).eq('user_id', userId);
          if (error) throw error;
          return jsonResponse({ ok: true });
        } else {
          return jsonResponse({ ok: false, message: 'Unsupported method' }, { status: 405 });
        }
      }

      default:
        return jsonResponse({ ok: false, message: `Unknown resource: ${resource}` }, { status: 400 });
    }
  } catch (error) {
    console.error("assistant-actions error:", error);
    return jsonResponse({ ok: false, message: (error as any)?.message || "Error" }, { status: 500 });
  }
});
