import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Jood Agent Tools — Webhook endpoint for ElevenLabs Conversational AI
//
// ElevenLabs Agent calls this when the LLM decides to use a tool.
// Each tool maps to a Supabase DB query — read/write/update/delete.
//
// The agent_id header is sent by ElevenLabs to identify the source.
// We use SUPABASE_SERVICE_ROLE_KEY because this runs server-side,
// but scope all queries to the user_id passed by the agent.
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { tool_name, parameters } = await req.json();
    const userId = parameters?.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (tool_name) {

      // ═══ READ TOOLS ═══════════════════════════════════════════════════════

      case "get_daily_briefing": {
        // Everything Jood needs to know when the call starts
        const today = new Date().toISOString().slice(0, 10);

        const [tasks, events, habits, moods, finance, memories, recentChats] = await Promise.all([
          supabase.from("tasks").select("title, due_date, priority, status")
            .eq("user_id", userId).in("status", ["pending", "in_progress"])
            .order("due_date", { ascending: true }).limit(15),

          supabase.from("calendar_events").select("title, starts_at, ends_at, location")
            .eq("user_id", userId).gte("starts_at", today)
            .order("starts_at", { ascending: true }).limit(10),

          supabase.from("habits").select("name, frequency, current_streak, is_active")
            .eq("user_id", userId).eq("is_active", true).limit(10),

          supabase.from("mood_entries").select("score, label, note, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }).limit(5),

          supabase.from("financial_entries").select("type, amount, currency, category, description, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }).limit(15),

          supabase.from("user_memories").select("category, content, importance")
            .eq("user_id", userId)
            .order("importance", { ascending: false }).limit(20),

          supabase.from("chat_messages").select("role, content, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }).limit(10),
        ]);

        // Build financial summary
        const entries = finance.data ?? [];
        const totalIncome = entries.filter(e => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
        const totalExpense = entries.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);

        result = {
          today,
          pending_tasks: tasks.data ?? [],
          upcoming_events: events.data ?? [],
          active_habits: habits.data ?? [],
          recent_moods: moods.data ?? [],
          financial_summary: {
            recent_income: totalIncome,
            recent_expenses: totalExpense,
            balance_hint: totalIncome - totalExpense,
            recent_transactions: entries.slice(0, 5),
          },
          memories_about_user: memories.data ?? [],
          recent_chat_history: (recentChats.data ?? []).reverse(),
        };
        break;
      }

      case "get_tasks": {
        const status = parameters.status ?? "pending";
        const query = supabase.from("tasks").select("id, title, due_date, priority, status, description")
          .eq("user_id", userId);
        if (status !== "all") query.eq("status", status);
        const { data } = await query.order("due_date", { ascending: true }).limit(20);
        result = { tasks: data ?? [] };
        break;
      }

      case "get_financial_summary": {
        const { data } = await supabase.from("financial_entries")
          .select("type, amount, currency, category, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(30);
        const entries = data ?? [];
        const income = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
        const expense = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
        const savings = entries.filter(e => e.type === "savings").reduce((s, e) => s + e.amount, 0);
        result = {
          total_income: income,
          total_expenses: expense,
          total_savings: savings,
          net: income - expense,
          recent_transactions: entries.slice(0, 10),
        };
        break;
      }

      case "get_schedule": {
        const daysAhead = parameters.days_ahead ?? 7;
        const from = new Date().toISOString();
        const to = new Date(Date.now() + daysAhead * 86400000).toISOString();
        const { data } = await supabase.from("calendar_events")
          .select("id, title, starts_at, ends_at, location, description")
          .eq("user_id", userId).gte("starts_at", from).lte("starts_at", to)
          .order("starts_at", { ascending: true });
        result = { events: data ?? [] };
        break;
      }

      case "get_goals": {
        const { data } = await supabase.from("savings_goals")
          .select("id, title, target_amount, saved_amount, target_date, status")
          .eq("user_id", userId).limit(10);
        result = { goals: data ?? [] };
        break;
      }

      case "get_mood_history": {
        const days = parameters.days ?? 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data } = await supabase.from("mood_entries")
          .select("score, label, note, created_at")
          .eq("user_id", userId).gte("created_at", since)
          .order("created_at", { ascending: false });
        result = { moods: data ?? [] };
        break;
      }

      // ═══ WRITE TOOLS ══════════════════════════════════════════════════════

      case "add_task": {
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: parameters.title,
          due_date: parameters.due_date ?? new Date().toISOString().slice(0, 10),
          priority: parameters.priority ?? "medium",
          description: parameters.notes ?? null,
          status: "pending",
          category: "general",
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم إضافة مهمة "${parameters.title}"` };
        break;
      }

      case "add_financial_entry": {
        const { error } = await supabase.from("financial_entries").insert({
          user_id: userId,
          type: parameters.type,
          amount: parameters.amount,
          currency: parameters.currency ?? "SAR",
          category: parameters.category ?? "general",
          description: parameters.description ?? "",
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم تسجيل ${parameters.type === "expense" ? "مصروف" : "دخل"} ${parameters.amount} ${parameters.currency ?? "ريال"}` };
        break;
      }

      case "add_event": {
        const { error } = await supabase.from("calendar_events").insert({
          user_id: userId,
          title: parameters.title,
          starts_at: parameters.starts_at,
          ends_at: parameters.ends_at ?? null,
          location: parameters.location ?? null,
          description: parameters.description ?? null,
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم إضافة موعد "${parameters.title}"` };
        break;
      }

      case "log_mood": {
        const { error } = await supabase.from("mood_entries").insert({
          user_id: userId,
          score: parameters.score,
          label: parameters.label,
          note: parameters.note ?? null,
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم تسجيل مزاجك: ${parameters.label}` };
        break;
      }

      case "update_task": {
        const updates: any = {};
        if (parameters.new_title) updates.title = parameters.new_title;
        if (parameters.due_date) updates.due_date = parameters.due_date;
        if (parameters.priority) updates.priority = parameters.priority;
        if (parameters.status) updates.status = parameters.status;
        if (parameters.notes) updates.description = parameters.notes;

        // Find task by title keyword
        const { data: found } = await supabase.from("tasks")
          .select("id, title").eq("user_id", userId).eq("status", "pending")
          .ilike("title", `%${parameters.search_title}%`).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت مهمة "${parameters.search_title}"` };
        } else {
          const { error } = await supabase.from("tasks").update(updates).eq("id", found[0].id);
          result = error
            ? { success: false, error: error.message }
            : { success: true, message: `تم تعديل مهمة "${found[0].title}"` };
        }
        break;
      }

      case "delete_task": {
        const { data: found } = await supabase.from("tasks")
          .select("id, title").eq("user_id", userId)
          .ilike("title", `%${parameters.search_title}%`).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت مهمة "${parameters.search_title}"` };
        } else {
          const { error } = await supabase.from("tasks").delete().eq("id", found[0].id);
          result = error
            ? { success: false, error: error.message }
            : { success: true, message: `تم حذف مهمة "${found[0].title}"` };
        }
        break;
      }

      case "remember": {
        const { error } = await supabase.from("user_memories").insert({
          user_id: userId,
          category: parameters.category ?? "preferences",
          content: parameters.fact,
          importance: parameters.importance ?? 0.6,
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: "تم الحفظ في ذاكرتي" };
        break;
      }

      default:
        result = { error: `Unknown tool: ${tool_name}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("jood-agent-tools error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
