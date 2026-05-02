import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const lat  = url.searchParams.get("lat")  ?? "24.7136"; // Riyadh default
    const lng  = url.searchParams.get("lng")  ?? "46.6753";
    const city = url.searchParams.get("city") ?? "riyadh";
    const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];

    // Check cache first
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: cached } = await supabase
      .from("prayer_times_cache")
      .select("*")
      .eq("city", city)
      .eq("date", date)
      .single();

    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from Aladhan (free, no key required)
    const [y, m, d] = date.split("-");
    const res = await fetch(
      `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lng}&method=4`
    );
    const json = await res.json();
    const t = json?.data?.timings;

    if (!t) throw new Error("Failed to fetch prayer times");

    const row = { city, date, fajr: t.Fajr, dhuhr: t.Dhuhr, asr: t.Asr, maghrib: t.Maghrib, isha: t.Isha };

    // Cache it
    await supabase.from("prayer_times_cache").upsert(row);

    return new Response(JSON.stringify(row), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
