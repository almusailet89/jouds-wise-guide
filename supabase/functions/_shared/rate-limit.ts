// Generic per-user, per-endpoint, per-hour rate limiter backed by endpoint_rate_limits.
// Mirrors the pattern already proven in ai-chat/index.ts (usage_counters + ai_requests),
// but kept in its own table so existing ai-chat behavior is untouched.
//
// Non-fatal by design: if the counter read/write itself fails, the request proceeds —
// a broken counter should never be the reason a legitimate user gets blocked.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface RateLimitResult {
  limited: boolean;
  used: number;
  limit: number;
  resetsAt: string;
}

export interface PlanTier {
  isAdmin: boolean;
  isSignature: boolean;
}

// Mirrors the tier-detection already proven in ai-chat/index.ts (lines ~932-942):
// admin/moderator role → unlimited; Signature plan → higher limit; else → base limit.
export async function getPlanTier(supabase: SupabaseClient, userId: string): Promise<PlanTier> {
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  const isAdmin = roleRow?.role === "admin" || roleRow?.role === "moderator";

  const { data: subRow } = await supabase
    .from("subscriptions_moyasar").select("plan_id, status").eq("user_id", userId).eq("status", "active").maybeSingle();
  const isSignature = !!(subRow?.plan_id?.includes("Signature") || subRow?.plan_id?.includes("vSc0"));

  return { isAdmin, isSignature };
}

export async function checkAndIncrementRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  limit: number,
): Promise<RateLimitResult> {
  const windowHour = new Date();
  windowHour.setMinutes(0, 0, 0);
  const windowKey = windowHour.toISOString();
  const resetsAt = new Date(windowHour.getTime() + 3600_000).toISOString();

  try {
    const { data: row } = await supabase
      .from("endpoint_rate_limits")
      .select("request_count")
      .eq("user_id", userId)
      .eq("window_hour", windowKey)
      .eq("endpoint", endpoint)
      .maybeSingle();

    const used = row?.request_count ?? 0;
    if (used >= limit) {
      return { limited: true, used, limit, resetsAt };
    }

    await supabase.from("endpoint_rate_limits").upsert(
      { user_id: userId, window_hour: windowKey, endpoint, request_count: used + 1 },
      { onConflict: "user_id,window_hour,endpoint" },
    );

    return { limited: false, used: used + 1, limit, resetsAt };
  } catch {
    // Counter unavailable — fail open, never block a legitimate request over our own bug.
    return { limited: false, used: 0, limit, resetsAt };
  }
}
