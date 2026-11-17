import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { checkAndIncrementRateLimit } from "../_shared/rate-limit.ts";
import { runAgentTool } from "../_shared/agent-tools.ts";
import { LIVE_TOOL_NAMES } from "../_shared/live-tool-declarations.ts";

// ─── Gemini Live: tool calls ─────────────────────────────────────────────────
// Gemini Live sends function calls to the browser; the browser forwards each one
// here with the user's own JWT. The user id always comes from the verified JWT,
// never from the request body.

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json({ error: "Invalid token" }, 401, corsHeaders);

    const { name, args } = await req.json();
    if (typeof name !== "string" || !LIVE_TOOL_NAMES.has(name)) {
      return json({ error: `Unknown tool: ${String(name)}` }, 400, corsHeaders);
    }

    const rl = await checkAndIncrementRateLimit(supabase, user.id, "gemini-live-tools", 240);
    if (rl.limited) return json({ error: "rate_limited", resets_at: rl.resetsAt }, 429, corsHeaders);

    const params = (args && typeof args === "object") ? { ...args } : {};
    delete (params as Record<string, unknown>).user_id;
    const result = await runAgentTool(supabase, user.id, name, params);
    return json({ result }, 200, corsHeaders);
  } catch (err) {
    console.error("gemini-live-tools error:", err);
    return json({ error: "internal" }, 500, corsHeaders);
  }
});
