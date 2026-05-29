import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stt-model",
};

// ─── Saudi Dialect Vocabulary Normalisation ────────────────────────────────────
// gpt-4o-transcribe handles Saudi dialect much better than whisper-1,
// but this layer ensures perfectly colloquial terms map to MSA for GPT-4o.
const SAUDI_VOCAB: [RegExp, string][] = [
  [/\bبكرة\b/g,              "غداً"],
  [/\bالحين\b/g,             "الآن"],
  [/\bتو\b|\bتوّ\b/g,        "الآن"],
  [/\bمن زمان\b/g,           "منذ وقت طويل"],
  [/\bمصاريف\b/g,            "مصروفات"],
  [/\bفلوس\b/g,              "أموال"],
  [/\bريّال\b/g,             "ريال سعودي"],
  [/\bقرض\b/g,               "قرض مالي"],
  [/\bوش\b|\bايش\b/g,        "ماذا"],
  [/\bكيفك\b/g,              "كيف حالك"],
  [/\bزين\b|\bزيّن\b/g,      "جيد"],
  [/\bتمام\b/g,              "حسناً"],
  [/\bبس\b/g,                "فقط"],
  [/\bشوي\b/g,               "قليلاً"],
  [/\bكذا\b/g,               "هكذا"],
  [/\bعندي\b/g,              "لدي"],
  [/\bما عندي\b/g,           "ليس لدي"],
  [/\bأبي\b|\bأبغى\b/g,      "أريد"],
  [/\bأقدر\b/g,              "أستطيع"],
  [/\bما أقدر\b/g,           "لا أستطيع"],
  [/\bحاسبني\b/g,            "احسب لي"],
  [/\bشكلك\b/g,              "يبدو أنك"],
  [/\bهلا\b/g,               "أهلاً"],
  [/\bمرحبا\b/g,             "أهلاً"],
  [/\bيزاك الله خير\b/g,     "شكراً جزيلاً"],
  [/\bلا هنت\b/g,            "شكراً"],
];

function normalizeSaudiDialect(text: string): string {
  let normalized = text;
  for (const [pattern, replacement] of SAUDI_VOCAB) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

// ─── Language detection ────────────────────────────────────────────────────────
function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const arabicChars = (text.match(/[؀-ۿ]/g) || []).length;
  const latinChars  = (text.match(/[a-zA-Z]/g) || []).length;
  const total = arabicChars + latinChars;
  if (total === 0) return "ar";
  const ratio = arabicChars / total;
  if (ratio > 0.70) return "ar";
  if (ratio < 0.30) return "en";
  return "mixed";
}

// ─── Saudi dialect prompt ──────────────────────────────────────────────────────
// Primes transcription with Saudi vocabulary so the model picks correct spellings.
// Works for both gpt-4o-transcribe and whisper-1.
const SAUDI_PROMPT =
  "Saudi Arabic executive assistant — personal finance, tasks, planning, daily life. " +
  "Speaker uses Saudi dialect mixed naturally with English business/tech terms. " +
  "Common Saudi words: بكرة (tomorrow), مصاريف (expenses), راتب (salary), فلوس (money), " +
  "زين (good/okay), وش/ايش (what), الحين/تو (now), بس (just/only), شوي (a little), " +
  "أبي/أبغى (I want), أقدر (I can), عندي (I have), هلا (hi), تمام (okay), سم (yes sir). " +
  "Finance: ريال (SAR), استثمار (investment), محفظة (portfolio), أسهم (stocks), كريبتو (crypto). " +
  "Preserve both Arabic and English words exactly as spoken.";

// ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required", text: "", language: "ar" }),
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
        JSON.stringify({ error: "Invalid token", text: "", language: "ar" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    // ── Determine STT model ────────────────────────────────────────────────
    // Client can pass x-stt-model header to skip the DB lookup entirely (~100ms saved).
    // gpt-4o-mini-transcribe: fastest, great accuracy for Saudi dialect voice chat
    // gpt-4o-transcribe: highest accuracy, slightly slower
    // whisper-1: legacy fallback
    const headerModel = req.headers.get("x-stt-model");
    let sttModel: string;
    if (headerModel && ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"].includes(headerModel)) {
      sttModel = headerModel;
    } else {
      // Fall back to profile lookup only if no header sent
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("stt_model")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      sttModel = profile?.stt_model ?? "gpt-4o-mini-transcribe";
    }

    // ── Parse audio from request ───────────────────────────────────────────
    let audioBytes: Uint8Array;
    let audioMimeType = "audio/webm";
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio") as File | null;
      if (!file) throw new Error("No audio file in form data");
      audioBytes    = new Uint8Array(await file.arrayBuffer());
      audioMimeType = file.type || "audio/webm";
    } else {
      const body = await req.json();
      if (!body.audio) throw new Error("No audio data provided");
      const binary = atob(body.audio);
      audioBytes    = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) audioBytes[i] = binary.charCodeAt(i);
      audioMimeType = body.mime_type ?? "audio/webm";
    }

    const ext = audioMimeType.includes("mp4")  ? "mp4"
              : audioMimeType.includes("ogg")  ? "ogg"
              : audioMimeType.includes("wav")  ? "wav"
              : audioMimeType.includes("m4a")  ? "m4a"
              : "webm";

    console.log(`[stt] model=${sttModel} ext=${ext} bytes=${audioBytes.length}`);

    // ── Helper: call OpenAI transcription ──────────────────────────────────
    const transcribe = async (model: string, forceAr: boolean): Promise<string> => {
      const form = new FormData();
      form.append("file",            new Blob([audioBytes], { type: audioMimeType }), `audio.${ext}`);
      form.append("model",           model);
      form.append("prompt",          SAUDI_PROMPT);
      form.append("response_format", "json");
      // KEY FIX: DO NOT force language="ar" for gpt-4o-transcribe.
      // Saudi speakers mix Arabic + English — auto-detect handles this correctly.
      // whisper-1 benefits from explicit "ar" hint for better dialect handling.
      if (forceAr) form.append("language", "ar");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`${model} transcription failed (${res.status}): ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.text ?? "";
    };

    // ── Primary transcription + whisper-1 fallback ─────────────────────────
    let rawTranscript = "";
    let engineUsed    = sttModel;

    try {
      // gpt-4o-transcribe and gpt-4o-mini-transcribe: no language lock (auto-detect)
      // whisper-1: force "ar" for Saudi dialect
      rawTranscript = await transcribe(sttModel, sttModel === "whisper-1");
    } catch (primaryErr) {
      console.warn(`[stt] ${sttModel} failed — falling back to whisper-1:`, primaryErr);
      try {
        rawTranscript = await transcribe("whisper-1", true);
        engineUsed    = "whisper-1-fallback";
      } catch (fallbackErr) {
        throw new Error(`All STT models failed: ${fallbackErr}`);
      }
    }

    // ── Post-process ───────────────────────────────────────────────────────
    const detectedLang   = detectLanguage(rawTranscript);
    const normalizedText = normalizeSaudiDialect(rawTranscript);

    console.log(`[stt] "${rawTranscript.slice(0, 80)}" → lang=${detectedLang} engine=${engineUsed}`);

    return new Response(
      JSON.stringify({
        text:     normalizedText,
        raw:      rawTranscript,
        language: detectedLang,
        chars:    normalizedText.length,
        engine:   engineUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("whisper-transcribe error:", err);
    return new Response(
      JSON.stringify({ error: String(err), text: "", language: "ar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
