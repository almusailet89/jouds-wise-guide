import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

const USER_TABLES = [
  "profiles",
  "financial_data",
  "portfolio_holdings",
  "tasks",
  "mood_logs",
  "ai_interactions",
  "user_roles",
  "user_agreements",
  "chat_sessions",
  "chat_messages",
  "habits",
  "habit_logs",
  "ai_recommendations",
  "events",
  "goals",
  "user_memories",
  "daily_briefs",
  "support_tickets",
] as const;

const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeadersFor(req),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Authorization required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: "Invalid session" }, 401);

    const userId = authData.user.id;
    const accountData: Record<string, unknown[]> = {};

    for (const table of USER_TABLES) {
      const rows: unknown[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", userId)
          .range(from, from + 999);

        if (error) throw new Error(`Could not export ${table}: ${error.message}`);
        const page = data ?? [];
        rows.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }

      accountData[table] = rows;
    }

    const ticketIds = (accountData.support_tickets ?? [])
      .map((row) => (row as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
    if (ticketIds.length > 0) {
      const { data, error } = await supabase.from("support_messages").select("*").in("ticket_id", ticketIds);
      if (error) throw new Error(`Could not export support_messages: ${error.message}`);
      accountData.support_messages = data ?? [];
    } else {
      accountData.support_messages = [];
    }

    return json(req, {
      exported_at: new Date().toISOString(),
      user_id: userId,
      account_email: authData.user.email ?? null,
      data: accountData,
    });
  } catch (error) {
    console.error("export-account-data error", error);
    return json(req, { error: "Account export could not be completed" }, 500);
  }
});
