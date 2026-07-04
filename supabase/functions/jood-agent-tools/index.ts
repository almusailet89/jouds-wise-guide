import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// Jood Agent Tools — Webhook endpoint for ElevenLabs Conversational AI
//
// ElevenLabs Agent calls this when the LLM decides to use a tool.
// Each tool maps to a Supabase DB query — read/write/update/delete.
//
// SECURITY: this endpoint trusts whatever user_id is in the request body and
// runs full CRUD via the service role key, so every request MUST carry the
// x-jood-agent-secret header matching JOOD_AGENT_TOOLS_SECRET (see check below).
// Configure that header in the ElevenLabs agent's tool/webhook settings — without
// it, ElevenLabs cannot reach a real user's data, but neither can anyone else.
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Webhook auth — this endpoint takes a user_id straight from the request body
  // and runs full CRUD via the service role key, so it MUST verify the caller is
  // actually ElevenLabs before trusting that user_id. ElevenLabs' Conversational AI
  // can't carry the end-user's Supabase JWT (it's a server-to-server tool call), so
  // we verify a shared secret instead — set as a custom header on the ElevenLabs
  // agent's tool/webhook config, matched against the JOOD_AGENT_TOOLS_SECRET secret.
  const providedSecret = req.headers.get("x-jood-agent-secret");
  const expectedSecret = Deno.env.get("JOOD_AGENT_TOOLS_SECRET");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

          supabase.from("events").select("title, starts_at, ends_at, location, category, description")
            .eq("user_id", userId).gte("starts_at", today)
            .order("starts_at", { ascending: true }).limit(10),

          supabase.from("habits").select("name, frequency, current_streak, is_active")
            .eq("user_id", userId).eq("is_active", true).limit(10),

          supabase.from("mood_logs").select("mood_score, mood_label, note, created_at")
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
        const { data } = await supabase.from("events")
          .select("id, title, starts_at, ends_at, location, description, category, all_day")
          .eq("user_id", userId).gte("starts_at", from).lte("starts_at", to)
          .order("starts_at", { ascending: true });
        result = { events: data ?? [] };
        break;
      }

      case "check_availability": {
        // Is the user free at this time? Returns conflicts if any.
        const start = new Date(parameters.starts_at);
        const end = parameters.ends_at ? new Date(parameters.ends_at) : new Date(start.getTime() + 3600000);
        const { data } = await supabase.from("events")
          .select("title, starts_at, ends_at, location")
          .eq("user_id", userId)
          .lt("starts_at", end.toISOString())
          .gt("ends_at", start.toISOString());
        const conflicts = data ?? [];
        result = conflicts.length
          ? { available: false, conflicts, message: `يوجد تعارض مع: ${conflicts.map(c => c.title).join("، ")}` }
          : { available: true, message: "الوقت متاح" };
        break;
      }

      case "get_goals": {
        const { data } = await supabase.from("goals")
          .select("id, title, target_amount, saved_amount, target_date, status, progress")
          .eq("user_id", userId).limit(10);
        result = { goals: data ?? [] };
        break;
      }

      case "get_mood_history": {
        const days = parameters.days ?? 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data } = await supabase.from("mood_logs")
          .select("mood_score, mood_label, note, created_at")
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
        const startsAt = parameters.starts_at;
        const endsAt = parameters.ends_at
          ?? new Date(new Date(startsAt).getTime() + 3600000).toISOString();

        // ── Conflict guard — never double-book ─────────────────────────────
        // force=true skips the check (user already confirmed the overlap)
        if (!parameters.force) {
          const { data: clash } = await supabase.from("events")
            .select("title, starts_at, ends_at")
            .eq("user_id", userId)
            .lt("starts_at", endsAt)
            .gt("ends_at", startsAt)
            .limit(3);
          if (clash?.length) {
            result = {
              success: false,
              conflict: true,
              conflicts: clash,
              message: `تنبيه: يوجد تعارض مع "${clash[0].title}". اسأل المستخدم إذا يريد الحجز رغم التعارض (أعد الاستدعاء مع force=true) أو اقترح وقتاً آخر.`,
            };
            break;
          }
        }

        const { error } = await supabase.from("events").insert({
          user_id: userId,
          title: parameters.title,
          starts_at: startsAt,
          ends_at: endsAt,
          start_at: startsAt,
          end_at: endsAt,
          location: parameters.location ?? null,
          description: parameters.description ?? null,
          category: parameters.category ?? "personal",
          all_day: parameters.all_day ?? false,
          reminder_min: parameters.reminder_min ?? 15,
          recurrence: parameters.recurrence ?? null, // daily | weekly | monthly | yearly
          source: "jood_voice",
        });
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم إضافة موعد "${parameters.title}"${parameters.location ? ` في ${parameters.location}` : ""}` };
        break;
      }

      case "update_event": {
        const { data: found } = await supabase.from("events")
          .select("id, title").eq("user_id", userId)
          .ilike("title", `%${parameters.search_title}%`)
          .order("starts_at", { ascending: false }).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت موعد "${parameters.search_title}"` };
          break;
        }
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (parameters.new_title)   updates.title = parameters.new_title;
        if (parameters.starts_at) { updates.starts_at = parameters.starts_at; updates.start_at = parameters.starts_at; }
        if (parameters.ends_at)   { updates.ends_at = parameters.ends_at; updates.end_at = parameters.ends_at; }
        if (parameters.location)    updates.location = parameters.location;
        if (parameters.description) updates.description = parameters.description;

        const { error } = await supabase.from("events").update(updates).eq("id", found[0].id);
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم تعديل موعد "${found[0].title}"` };
        break;
      }

      case "delete_event": {
        const { data: found } = await supabase.from("events")
          .select("id, title").eq("user_id", userId)
          .ilike("title", `%${parameters.search_title}%`)
          .order("starts_at", { ascending: false }).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت موعد "${parameters.search_title}"` };
          break;
        }
        const { error } = await supabase.from("events").delete().eq("id", found[0].id);
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم إلغاء موعد "${found[0].title}"` };
        break;
      }

      case "update_financial_entry": {
        const { data: found } = await supabase.from("financial_entries")
          .select("id, description, amount").eq("user_id", userId)
          .ilike("description", `%${parameters.search_desc}%`)
          .order("created_at", { ascending: false }).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت معاملة "${parameters.search_desc}"` };
          break;
        }
        const updates: Record<string, unknown> = {};
        if (parameters.new_amount)      updates.amount = parameters.new_amount;
        if (parameters.new_type)        updates.type = parameters.new_type;
        if (parameters.new_category)    updates.category = parameters.new_category;
        if (parameters.new_description) updates.description = parameters.new_description;

        const { error } = await supabase.from("financial_entries").update(updates).eq("id", found[0].id);
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم تعديل المعاملة "${found[0].description}"` };
        break;
      }

      case "delete_financial_entry": {
        const { data: found } = await supabase.from("financial_entries")
          .select("id, description, amount").eq("user_id", userId)
          .ilike("description", `%${parameters.search_desc}%`)
          .order("created_at", { ascending: false }).limit(1);

        if (!found?.length) {
          result = { success: false, message: `ما لقيت معاملة "${parameters.search_desc}"` };
          break;
        }
        const { error } = await supabase.from("financial_entries").delete().eq("id", found[0].id);
        result = error
          ? { success: false, error: error.message }
          : { success: true, message: `تم حذف معاملة "${found[0].description}" (${found[0].amount} ريال)` };
        break;
      }

      case "log_mood": {
        const { error } = await supabase.from("mood_logs").insert({
          user_id: userId,
          mood_score: Math.max(1, Math.min(10, Math.round(Number(parameters.score)))),
          mood_label: parameters.label,
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
          kind: "fact",
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
