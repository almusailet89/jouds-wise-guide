import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

// Disabled stop-gap: the previous version wrote random prices into every user's
// holdings. It changes nothing until a per-user, real-price rewrite replaces it.
serve((req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: false, error: "refresh_disabled", updated_count: 0 }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
