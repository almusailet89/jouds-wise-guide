import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// admin-stats — aggregate metrics for the founder dashboard
//
// Browser RLS correctly blocks cross-user reads, so the admin page calls this
// instead. Service role runs the aggregates, but ONLY after verifying the
// caller's JWT belongs to a user with the 'admin' role in user_roles.
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── Verify caller is an admin ───────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Aggregates ──────────────────────────────────────────────────────────
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const d30 = new Date(now - 30 * 86400000).toISOString();

    const cnt = (q: any) => q.then((r: any) => r.count ?? 0);

    const [
      totalUsers, newUsers7d, messages30d, messages7d,
      voiceEvents30d, tasksOpen, events30d, moods30d, activeSubs,
    ] = await Promise.all([
      cnt(supabase.from("profiles").select("*", { count: "exact", head: true })),
      cnt(supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", d7)),
      cnt(supabase.from("chat_messages").select("*", { count: "exact", head: true }).gte("created_at", d30)),
      cnt(supabase.from("chat_messages").select("*", { count: "exact", head: true }).gte("created_at", d7)),
      cnt(supabase.from("events").select("*", { count: "exact", head: true }).eq("source", "jood_voice").gte("created_at", d30)),
      cnt(supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "pending")),
      cnt(supabase.from("events").select("*", { count: "exact", head: true }).gte("created_at", d30)),
      cnt(supabase.from("mood_logs").select("*", { count: "exact", head: true }).gte("created_at", d30)),
      cnt(supabase.from("subscriptions_moyasar").select("*", { count: "exact", head: true }).eq("status", "active")),
    ]);

    // Distinct active users last 7d (from chat activity)
    const { data: activeRows } = await supabase.from("chat_messages")
      .select("user_id").gte("created_at", d7).limit(5000);
    const activeUsers7d = new Set((activeRows ?? []).map((r: any) => r.user_id)).size;

    // Revenue estimate — active subscriptions × Essential price (SAR)
    const PRICE_SAR = 29;
    const mrrSar = activeSubs * PRICE_SAR;

    return new Response(JSON.stringify({
      users:  { total: totalUsers, new_7d: newUsers7d, active_7d: activeUsers7d },
      usage:  { messages_30d: messages30d, messages_7d: messages7d,
                voice_events_30d: voiceEvents30d, events_30d: events30d,
                moods_30d: moods30d, open_tasks: tasksOpen },
      revenue:{ active_subscriptions: activeSubs, mrr_sar: mrrSar,
                arr_sar: mrrSar * 12, note: "MRR estimated at Essential tier price" },
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("admin-stats error:", err);
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
