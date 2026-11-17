import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { runAgentTool } from "../_shared/agent-tools.ts";

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

    const result = await runAgentTool(supabase, userId, tool_name, parameters ?? {});

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
