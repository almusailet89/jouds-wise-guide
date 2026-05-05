import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, user is not subscribed");
      return new Response(JSON.stringify({ 
        subscribed: false,
        inTrial: false,
        plan: null,
        subscriptionEnd: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Check for trialing subscriptions
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });

      if (trialingSubscriptions.data.length > 0) {
        const subscription = trialingSubscriptions.data[0];
        const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
        const priceId = subscription.items.data[0].price.id;
        
        // Determine plan based on price ID
        let plan = 'monthly';
        if (priceId === 'price_1S8Q7ZDlAGsKyGn8w97rsZ5B') {
          plan = 'annual';
        }

        logStep("Trial subscription found", { subscriptionId: subscription.id, trialEnd, plan });
        return new Response(JSON.stringify({
          subscribed: true,
          inTrial: true,
          plan,
          subscriptionEnd,
          trialEnd
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Check for past_due subscriptions — payment failed but still in grace period
      const pastDueSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "past_due",
        limit: 1,
      });

      if (pastDueSubscriptions.data.length > 0) {
        const subscription = pastDueSubscriptions.data[0];
        const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const priceId = subscription.items.data[0].price.id;
        let plan = 'monthly';
        if (priceId === 'price_1S8Q7ZDlAGsKyGn8w97rsZ5B') {
          plan = 'annual';
        }
        logStep("Past-due subscription found", { subscriptionId: subscription.id, plan });
        return new Response(JSON.stringify({
          subscribed: true,
          inTrial: false,
          paymentIssue: true,   // frontend uses this to show "update payment" banner
          plan,
          subscriptionEnd
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("No active, trial, or past-due subscription found");
      return new Response(JSON.stringify({
        subscribed: false,
        inTrial: false,
        plan: null,
        subscriptionEnd: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const priceId = subscription.items.data[0].price.id;
    
    // Determine plan based on price ID
    let plan = 'monthly';
    if (priceId === 'price_1S8Q7ZDlAGsKyGn8w97rsZ5B') {
      plan = 'annual';
    }

    logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd, plan });

    return new Response(JSON.stringify({
      subscribed: true,
      inTrial: false,
      plan,
      subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});