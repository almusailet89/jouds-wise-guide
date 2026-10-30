import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

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

    const body = await req.json().catch(() => ({})) as { confirmation?: string };
    if (body.confirmation !== "delete" && body.confirmation !== "حذف") {
      return json(req, { error: "Deletion confirmation did not match" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: "Invalid session" }, 401);

    const user = authData.user;

    // A legacy Moyasar subscription cannot be safely cancelled by this function.
    // Stop before deleting the account so billing is never left running silently.
    const { data: legacySubscriptions, error: legacyError } = await supabase
      .from("subscriptions_moyasar")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1);
    if (!legacyError && (legacySubscriptions?.length ?? 0) > 0) {
      return json(req, { error: "Active legacy subscription requires support cancellation" }, 409);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && user.email) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 100 });

      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        for (const subscription of subscriptions.data) {
          if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
            await stripe.subscriptions.cancel(subscription.id);
          }
        }
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    return json(req, { deleted: true });
  } catch (error) {
    console.error("delete-account error", error);
    return json(req, { error: "Account deletion could not be completed" }, 500);
  }
});
