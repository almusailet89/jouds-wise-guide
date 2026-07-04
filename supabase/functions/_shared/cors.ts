// Origin allow-list for all edge functions. Reflects the requesting Origin back
// only when it's on the list — closing the previous "Access-Control-Allow-Origin: *"
// hole, which let any website call these functions using a leaked anon key.
//
// Override/extend via the ALLOWED_ORIGINS secret (comma-separated), e.g.:
//   supabase secrets set ALLOWED_ORIGINS=https://your-production-domain,http://localhost:8080
const DEFAULT_ALLOWED_ORIGINS = [
  "https://almusailet89.github.io",
  "http://localhost:8080",
  "http://localhost:5173",
];

function allowedOrigins(): string[] {
  const fromEnv = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

/** Build CORS headers scoped to the requesting Origin, if it's allow-listed. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const allowed = allowedOrigins();
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
