import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Saudi Dialect Vocabulary Normalisation ────────────────────────────────────
// Maps common Saudi colloquial terms to their standard meanings so GPT-5
// reasons correctly even when Whisper outputs MSA approximations.
const SAUDI_VOCAB: [RegExp, string][] = [
  // Time
  [/\bبكرة\b/g,        "غداً"],
  [/\bالحين\b/g,       "الآن"],
  [/\bتو\b|\bتوّ\b/g,  "الآن"],
  [/\bمن زمان\b/g,     "منذ وقت طويل"],
  // Finance
  [/\bمصاريف\b/g,      "مصروفات"],
  [/\bراتب\b/g,        "دخل شهري"],
  [/\bفلوس\b/g,        "أموال"],
  [/\bريّال\b/g,       "ريال سعودي"],
  [/\bحساب\b/g,        "رصيد"],
  [/\bشيك\b/g,         "شيك مصرفي"],
  [/\bقرض\b/g,         "قرض مالي"],
  // Tasks/Life
  [/\bوش\b|\bايش\b/g,  "ماذا"],
  [/\bكيفك\b/g,        "كيف حالك"],
  [/\bزين\b|\bزيّن\b/g,"جيد"],
  [/\bتمام\b/g,        "حسناً"],
  [/\bبس\b/g,          "فقط"],
  [/\bشوي\b/g,         "قليلاً"],
  [/\bكذا\b/g,         "هكذا"],
  [/\bعندي\b/g,        "لدي"],
  [/\bما عندي\b/g,     "ليس لدي"],
  [/\bأبي\b|\bأبغى\b/g,"أريد"],
  [/\bأقدر\b/g,        "أستطيع"],
  [/\bما أقدر\b/g,     "لا أستطيع"],
  [/\bحاسبني\b/g,      "احسب لي"],
  [/\bوقفت\b/g,        "توقفت"],
  [/\bشكلك\b/g,        "يبدو أنك"],
  // Greetings/Affirmations
  [/\bهلا\b/g,         "أهلاً"],
  [/\bمرحبا\b/g,       "أهلاً"],
  [/\bيزاك الله خير\b/g, "شكراً جزيلاً"],
  [/\bلا هنت\b/g,      "شكراً"],
];

function normalizeSaudiDialect(text: string): string {
  let normalized = text;
  for (const [pattern, replacement] of SAUDI_VOCAB) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

// ─── Language detection (simple heuristic) ────────────────────────────────────
function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars  = (text.match(/[a-zA-Z]/g) || []).length;
  const total = arabicChars + latinChars;
  if (total === 0) return "ar";
  const arabicRatio = arabicChars / total;
  if (arabicRatio > 0.7) return "ar";
  if (arabicRatio < 0.3) return "en";
  return "mixed";
}

// ─── Whisper prompt engineered for Saudi dialect ───────────────────────────────
const WHISPER_SAUDI_PROMPT =
  "This is a Saudi Arabic executive assistant conversation about personal finance, " +
  "tasks, investments, and daily life planning. " +
  "The speaker uses Saudi dialect (لهجة سعودية) and may mix English terms naturally. " +
  "Common Saudi terms: بكرة (tomorrow), مصاريف (expenses), راتب (salary), " +
  "زين (good/okay), وش/ايش (what), الحين (now), بس (only/just), شوي (a little), " +
  "أبي/أبغى (I want), أقدر (I can). " +
  "Financial terms: ريال (SAR), استثمار (investment), محفظة (portfolio), زكاة (zakat). " +
  "Transcribe accurately — preserve dialect words as spoken.";

// ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    let audioBytes: Uint8Array;
    let audioMimeType = "audio/webm";

    const contentType = req.headers.get("content-type") ?? "";

    // ── Accept both binary multipart and base64 JSON ───────────────────────────
    if (contentType.includes("multipart/form-data")) {
      // Direct binary upload (preferred — from MediaRecorder)
      const form = await req.formData();
      const file = form.get("audio") as File | null;
      if (!file) throw new Error("No audio file in form data");
      audioBytes = new Uint8Array(await file.arrayBuffer());
      audioMimeType = file.type || "audio/webm";
    } else {
      // JSON with base64-encoded audio (legacy / fallback)
      const body = await req.json();
      if (!body.audio) throw new Error("No audio data provided");

      const binary = atob(body.audio);
      audioBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        audioBytes[i] = binary.charCodeAt(i);
      }
      audioMimeType = body.mime_type ?? "audio/webm";
    }

    // ── Send to OpenAI Whisper ─────────────────────────────────────────────────
    const form = new FormData();
    const blob = new Blob([audioBytes], { type: audioMimeType });

    // Whisper needs the filename extension to infer format
    const ext = audioMimeType.includes("webm") ? "webm"
              : audioMimeType.includes("mp4")  ? "mp4"
              : audioMimeType.includes("wav")  ? "wav"
              : audioMimeType.includes("ogg")  ? "ogg"
              : "webm";

    form.append("file", blob, `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "ar");                    // Primary language hint
    form.append("prompt", WHISPER_SAUDI_PROMPT);      // Dialect priming
    form.append("response_format", "json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      throw new Error(`Whisper API error (${whisperRes.status}): ${err}`);
    }

    const { text: rawTranscript } = await whisperRes.json();

    // ── Post-process: detect language + normalize vocabulary ───────────────────
    const detectedLang = detectLanguage(rawTranscript);
    const normalizedText = normalizeSaudiDialect(rawTranscript);

    console.log(`Whisper transcript: "${rawTranscript}" → normalized: "${normalizedText}" (${detectedLang})`);

    return new Response(
      JSON.stringify({
        text:        normalizedText,     // Use this for GPT
        raw:         rawTranscript,      // Original Whisper output
        language:    detectedLang,       // "ar" | "en" | "mixed"
        chars:       normalizedText.length,
        engine:      "whisper-1-saudi",
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
