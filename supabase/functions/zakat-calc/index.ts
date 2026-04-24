import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Nisab floor: 85g gold equivalent — fetched daily from gold price API
const GOLD_GRAMS_NISAB = 85;
const ZAKAT_RATE = 0.025; // 2.5%

async function getGoldPriceInSAR(): Promise<number> {
  try {
    // Free gold price API — returns USD per troy oz
    const res = await fetch("https://api.metals.live/v1/spot/gold");
    const json = await res.json();
    const usdPerOz = json?.[0]?.price ?? 7000;
    const sarPerUsd = 3.75; // pegged rate
    const gramsPerOz = 31.1035;
    return (usdPerOz / gramsPerOz) * sarPerUsd;
  } catch {
    // Fallback: ~SAR 230 per gram
    return 230;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { user_id, hawl_start_date } = await req.json();
    const uid = user_id ?? user.id;

    // Fetch holdings
    const { data: holdings, error } = await supabase
      .from("zakat_holdings")
      .select("*")
      .eq("user_id", uid);

    if (error) throw error;

    // Gold price for nisab calculation
    const goldPriceSAR = await getGoldPriceInSAR();
    const nisabSAR = goldPriceSAR * GOLD_GRAMS_NISAB;

    // Calculate hawl duration for each holding
    const hawlStartDate = new Date(hawl_start_date ?? new Date().toISOString().split("T")[0]);
    const today = new Date();
    const hawlCompleteDays = 354; // Lunar year

    const breakdown: Record<string, number> = {};
    let totalQualifyingWealth = 0;

    for (const h of holdings ?? []) {
      const holdingSince = new Date(h.hawl_start);
      const daysSince = Math.floor((today.getTime() - holdingSince.getTime()) / (1000 * 60 * 60 * 24));
      const hawlComplete = daysSince >= hawlCompleteDays;

      if (hawlComplete) {
        breakdown[h.asset_type] = (breakdown[h.asset_type] ?? 0) + Number(h.amount_sar);
        totalQualifyingWealth += Number(h.amount_sar);
      }
    }

    const aboveNisab = totalQualifyingWealth >= nisabSAR;
    const zarDue = aboveNisab ? totalQualifyingWealth * ZAKAT_RATE : 0;

    return new Response(JSON.stringify({
      nisab_sar: Math.round(nisabSAR),
      total_qualifying_wealth_sar: totalQualifyingWealth,
      above_nisab: aboveNisab,
      sar_due: Math.round(zarDue * 100) / 100,
      breakdown,
      gold_price_per_gram_sar: Math.round(goldPriceSAR),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
