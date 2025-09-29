import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FinType = "income" | "expense" | "investment" | "savings";

async function getNetBalance(supabase: any, userId: string): Promise<number> {
  // Compute net = (income + savings) - (expense + investment)
  const { data, error } = await supabase
    .from("financial_data")
    .select("type, amount")
    .eq("user_id", userId);
  if (error) throw error;
  let net = 0;
  for (const row of data || []) {
    const t = String(row.type) as FinType;
    const amt = Number(row.amount) || 0;
    if (t === "income" || t === "savings") net += amt;
    if (t === "expense" || t === "investment") net -= amt;
  }
  return net;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: auth } = await supabase.auth.getUser(token);
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const {
      type, // income | expense | savings | investment | adjust_wallet
      amount,
      currency = "SAR",
      category,
      description,
      date,
      allow_overdraft = false,
      confirmation_phrase,
      adjust_delta,
    } = payload || {};

    // Manual wallet adjustments
    if (type === "adjust_wallet") {
      const delta = Number(adjust_delta);
      if (!delta || Number.isNaN(delta)) {
        return new Response(JSON.stringify({ ok: false, message: "adjust_delta is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Log audit first
      const { error: auditErr } = await supabase.from("wallet_audit_log").insert({
        user_id: user.id,
        delta_sar: delta,
        reason: description || "manual_adjustment",
        confirmed_phrase: confirmation_phrase || null,
      });
      if (auditErr) {
        return new Response(JSON.stringify({ ok: false, message: auditErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Mirror into financial_data as income (+) or expense (-)
      const finType: FinType = delta >= 0 ? "income" : "expense";
      const { error: finErr } = await supabase.from("financial_data").insert({
        user_id: user.id,
        type: finType,
        amount: Math.abs(delta),
        currency,
        category: category || "manual_adjustment",
        note: description || null,
        label: category || finType,
        created_at: date || new Date().toISOString(),
      });
      if (finErr) {
        return new Response(JSON.stringify({ ok: false, message: finErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate normal write
    const t = String(type || "").toLowerCase() as FinType;
    if (!t || !["income", "expense", "savings", "investment"].includes(t)) {
      return new Response(JSON.stringify({ ok: false, message: "type must be income|expense|savings|investment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const amt = Number(amount);
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      return new Response(JSON.stringify({ ok: false, message: "amount must be > 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrail: prevent overspend unless confirmed
    if (t === "expense" || t === "investment") {
      const net = await getNetBalance(supabase, user.id);
      if (net - amt < 0) {
        const phraseOk = typeof confirmation_phrase === "string" && confirmation_phrase.trim().length > 8; // simple check
        if (!allow_overdraft || !phraseOk) {
          console.log(JSON.stringify({ event: "guardrail_violation", kind: "overspend", user_id: user.id }));
          return new Response(JSON.stringify({ ok: false, message: "insufficient_wallet_balance" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Log overdraft in audit
        await supabase.from("wallet_audit_log").insert({
          user_id: user.id,
          delta_sar: -amt,
          reason: "overdraft",
          confirmed_phrase: confirmation_phrase,
        });
      }
    }

    // Insert into financial_data
    const { error: insertErr } = await supabase.from("financial_data").insert({
      user_id: user.id,
      type: t,
      amount: amt,
      currency,
      category: category || null,
      note: description || null,
      label: category || t,
      created_at: date || new Date().toISOString(),
    });
    if (insertErr) {
      return new Response(JSON.stringify({ ok: false, message: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("finance-actions error:", err);
    return new Response(JSON.stringify({ ok: false, message: (err as any)?.message || "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
