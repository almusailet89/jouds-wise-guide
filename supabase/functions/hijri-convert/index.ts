import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url  = new URL(req.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const from = url.searchParams.get("from") ?? "gregorian"; // "gregorian" | "hijri"

    // Use Aladhan for conversion
    let apiUrl: string;
    if (from === "gregorian") {
      const [y, m, d] = date.split("-");
      apiUrl = `https://api.aladhan.com/v1/gToH/${d}-${m}-${y}`;
    } else {
      const [y, m, d] = date.split("-");
      apiUrl = `https://api.aladhan.com/v1/hToG/${d}-${m}-${y}`;
    }

    const res  = await fetch(apiUrl);
    const json = await res.json();
    const data = json?.data;

    if (!data) throw new Error("Conversion failed");

    return new Response(JSON.stringify({
      gregorian: data.gregorian?.date,
      hijri:     data.hijri?.date,
      hijri_month_ar: data.hijri?.month?.ar,
      hijri_month_en: data.hijri?.month?.en,
      hijri_year:     data.hijri?.year,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
