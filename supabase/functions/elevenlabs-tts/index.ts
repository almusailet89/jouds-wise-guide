import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

// ─── ElevenLabs Voice Configuration ────────────────────────────────────────────
//
// Voice Profile: "Jood" — Saudi Executive AI Assistant
//
// Persona: calm, professional, confident. Slight warmth. NOT robotic.
//
// Stability:        0.75  → consistent tone, not monotone. Executive presence.
// Similarity Boost: 0.80  → stays close to the cloned voice target.
// Style:            0.20  → subtle expressiveness. Calm, not flat.
// Use Speaker Boost: true → higher audio fidelity, cleaner output.
//
// Voice IDs (in priority order):
//   1. ELEVENLABS_VOICE_ID env var     — custom cloned Saudi voice (ideal)
//   2. "Sarah"  (ElevenLabs built-in)  — professional female, natural warmth
//   3. "Aria"   (ElevenLabs built-in)  — confident, calm female
//
// Arabic support: ElevenLabs multilingual-v2 model fully supports Arabic
// including Saudi dialect prosody when text is in Arabic script.

const DEFAULT_VOICE_ID = "rxI4CzWiL77Roff1cjW6"; // Jood custom clone voice

// ─── Voice settings tuned for Arabic + Saudi dialect ─────────────────────────
//
// Key insight: Arabic speech has wider pitch variance and different stress patterns
// than English. For natural-sounding Arabic:
//   - Lower stability (0.60-0.70) allows more natural pitch variation
//   - Higher style (0.30-0.45) captures the warmth in Saudi speech
//   - Speaker boost = true ensures crisp Arabic phoneme rendering
//
// Voice mode (real-time conversation): use turbo model, slightly lower settings
// for speed. Text mode: use multilingual-v2 for highest quality.
//
// Ameera Altweel-inspired voice profile — elegant, warm, bilingual feel
const VOICE_SETTINGS: Record<string, {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}> = {
  // Neutral: elegant confidence — Ameera's baseline composure
  neutral: {
    stability: 0.55,       // Lower = natural Arabic melodic flow
    similarity_boost: 0.85,
    style: 0.40,           // Rich expressiveness — never flat
    use_speaker_boost: true,
  },
  // Warm: greetings, celebrations, personal — ياااي ما شاء الله!
  warm: {
    stability: 0.48,       // Most expressive — genuine excitement
    similarity_boost: 0.82,
    style: 0.55,           // High warmth, smile in the voice
    use_speaker_boost: true,
  },
  // Confident: financial insights, action confirmations — composed authority
  confident: {
    stability: 0.62,
    similarity_boost: 0.86,
    style: 0.30,           // Calm elegance, measured pace
    use_speaker_boost: true,
  },
  // Empathetic: support, mood lows — يا قلبي لا تشيل هم
  empathetic: {
    stability: 0.45,       // Widest range — genuine caring
    similarity_boost: 0.80,
    style: 0.58,           // Maximum warmth, soft and present
    use_speaker_boost: true,
  },
  // Excited: achievements, good news — حلوو كذا عجبني!
  excited: {
    stability: 0.42,       // Most dynamic — energy in the voice
    similarity_boost: 0.82,
    style: 0.60,           // Peak expressiveness
    use_speaker_boost: true,
  },
};

// ─── Text pre-processing for Arabic TTS ──────────────────────────────────────
// ElevenLabs multilingual-v2 handles Arabic very well but sounds more natural
// with clean punctuation, no markdown, and slight prosody hints.
function prepareTextForTTS(text: string): string {
  return text
    // Remove markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g,    "$1")
    .replace(/`(.+?)`/g,      "$1")
    .replace(/#{1,6}\s/g,     "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    // Remove bullet/number prefixes — TTS voices them as "dash" or "number"
    .replace(/^[-•–*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm,  "")
    // Collapse paragraph breaks → Arabic pause marker (،)
    .replace(/\n{2,}/g, "، ")
    .replace(/\n/g, " ")
    // Remove parenthetical notes that read awkwardly in speech
    .replace(/\(.*?\)/g, "")
    // Normalise multiple spaces
    .replace(/\s{2,}/g, " ")
    // Remove standalone percent signs that trip up Arabic TTS
    .replace(/(\d)\s*%/g, "$1 بالمئة")
    // SAR amounts — help TTS pronounce correctly
    .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*ر\.س/g, "$1 ريال")
    .replace(/SAR\s*(\d+)/gi, "$1 ريال")
    .trim()
    // Cap at 500 chars — cost control + optimal spoken length per TTS call
    .slice(0, 500);
}

// ─── Brevity enforcer (voice mode: sentences already split client-side) ───────
// In voice mode, text is pre-split into ≤250-char sentences by the client.
// This function applies final cleanup without aggressive truncation.
function enforceVoiceBrevity(text: string, voiceMode: boolean): string {
  if (!voiceMode) return prepareTextForTTS(text);
  const cleaned = prepareTextForTTS(text);
  if (cleaned.length <= 260) return cleaned;

  // Try to cut at a natural sentence boundary
  const sentences = cleaned.split(/[.،؟!]/);
  let result = "";
  for (const s of sentences) {
    const candidate = result ? `${result}. ${s.trim()}` : s.trim();
    if (candidate.length <= 260) result = candidate;
    else break;
  }
  return result || cleaned.slice(0, 220);
}

// ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth guard — block unauthenticated calls to protect API quota ──────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
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
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      text,
      emotion = "neutral",
      voice_mode = false,   // true = brevity-capped, for Majlis real-time
      language = "ar",      // "ar" | "en" | "mixed"
      voice_id,             // Override voice (custom clone)
    } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elevenKey = Deno.env.get("ELEVENLABS_API_KEY");
    const targetVoiceId = voice_id
      ?? Deno.env.get("ELEVENLABS_VOICE_ID")
      ?? DEFAULT_VOICE_ID;

    const settings = VOICE_SETTINGS[emotion] ?? VOICE_SETTINGS.neutral;
    const processedText = enforceVoiceBrevity(text, voice_mode);

    console.log(`[elevenlabs-tts] emotion=${emotion} voice_mode=${voice_mode} chars=${processedText.length} model=${voice_mode ? 'turbo-v2.5' : 'multilingual-v2'}`);

    // ── Primary: ElevenLabs TTS ────────────────────────────────────────────────
    if (elevenKey) {
      // Voice mode uses turbo model + lower quality for ~2x faster response
      const modelId   = voice_mode ? "eleven_turbo_v2_5" : "eleven_multilingual_v2";
      const outFormat = voice_mode ? "mp3_22050_32"       : "mp3_44100_128";

      // Timeout: 15s for voice mode (turbo), 30s for text mode
      const ttsTimeout = voice_mode ? 15000 : 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ttsTimeout);

      let elevenRes: Response;
      try {
        elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream`,
          {
            method: "POST",
            headers: {
              "xi-api-key":   elevenKey,
              "Content-Type": "application/json",
              "Accept":       "audio/mpeg",
            },
            body: JSON.stringify({
              text:           processedText,
              model_id:       modelId,
              voice_settings: settings,
              output_format:  outFormat,
            }),
            signal: controller.signal,
          }
        );
      } catch (abortErr: any) {
        clearTimeout(timer);
        console.error(`ElevenLabs timeout after ${ttsTimeout}ms — falling back`);
        elevenRes = new Response(null, { status: 408 }); // force fallback
      }
      clearTimeout(timer);

      if (elevenRes.ok) {
        // Pipe stream directly — avoids double-buffering audio in edge function memory.
        // Client receives bytes as they arrive → faster first-byte latency per sentence.
        return new Response(elevenRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type":      "audio/mpeg",
            "X-Voice-Engine":    "elevenlabs-multilingual-v2",
            "X-Voice-ID":        targetVoiceId,
            "X-Emotion":         emotion,
            "X-Processed-Chars": String(processedText.length),
          },
        });
      }

      // Log ElevenLabs error but don't throw — fall through to Azure
      const errText = await elevenRes.text();
      console.error(`ElevenLabs error (${elevenRes.status}): ${errText} — falling back to Azure`);
    }

    // ── Fallback: Azure Neural ar-SA-ZariyahNeural ─────────────────────────────
    const azureKey    = Deno.env.get("AZURE_SPEECH_KEY");
    const azureRegion = Deno.env.get("AZURE_SPEECH_REGION") ?? "uaenorth";

    if (azureKey) {
      const prosodyMap: Record<string, string> = {
        neutral:    'rate="0.95" pitch="+0st"',
        warm:       'rate="0.90" pitch="+1st"',
        confident:  'rate="1.00" pitch="-1st"',
        empathetic: 'rate="0.88" pitch="+2st"',
      };
      const prosody = prosodyMap[emotion] ?? prosodyMap.neutral;
      const voice   = language === "ar" ? "ar-SA-ZariyahNeural" : "en-US-JennyNeural";
      const lang    = language === "ar" ? "ar-SA" : "en-US";

      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">
  <voice name="${voice}"><prosody ${prosody}>${processedText}</prosody></voice>
</speak>`;

      const azureRes = await fetch(
        `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureKey,
            "Content-Type":              "application/ssml+xml",
            "X-Microsoft-OutputFormat":  "audio-16khz-128kbitrate-mono-mp3",
            "User-Agent":                "JoodAI",
          },
          body: ssml,
        }
      );

      if (azureRes.ok) {
        const audio = await azureRes.arrayBuffer();
        return new Response(audio, {
          headers: {
            ...corsHeaders,
            "Content-Type":   "audio/mpeg",
            "X-Voice-Engine": "azure-neural-fallback",
            "X-Voice-ID":     voice,
            "X-Emotion":      emotion,
          },
        });
      }
    }

    // ── Last resort: OpenAI TTS (nova, no Arabic premium) ──────────────────────
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("No TTS engine configured");

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice: "nova",
        input: processedText,
        speed: 0.92,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI TTS error: ${err}`);
    }

    const audio = await openaiRes.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type":   "audio/mpeg",
        "X-Voice-Engine": "openai-tts-hd-last-resort",
      },
    });

  } catch (err) {
    console.error("elevenlabs-tts error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
