import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

// ─── ElevenLabs Conversational AI — Signed URL Provider ──────────────────────
//
// This edge function authenticates the user (JWT), then fetches a short-lived
// signed WebSocket URL from ElevenLabs. The frontend uses this URL to open a
// direct WebSocket connection to ElevenLabs Conversational AI — no API key
// is ever exposed to the browser.
//
// Required env vars:
//   ELEVENLABS_API_KEY        — your ElevenLabs API key
//   ELEVENLABS_AGENT_ID       — the Conversational AI agent ID from ElevenLabs dashboard
//
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get signed URL from ElevenLabs ────────────────────────────────────────
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const agentId       = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!elevenLabsKey || !agentId) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: { "xi-api-key": elevenLabsKey },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`ElevenLabs signed URL error (${res.status}): ${errText}`);
      return new Response(
        JSON.stringify({ error: "Failed to get signed URL" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    return new Response(
      JSON.stringify({ signed_url: data.signed_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("elevenlabs-agent-sign error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
