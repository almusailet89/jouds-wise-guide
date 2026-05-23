import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Sarah" — warm, professional

const VOICE_SETTINGS: Record<string, {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}> = {
  // Default voice mode: calm executive presence
  neutral: {
    stability: 0.75,
    similarity_boost: 0.80,
    style: 0.20,
    use_speaker_boost: true,
  },
  // Warm: slightly more expressive for personal/mood conversations
  warm: {
    stability: 0.68,
    similarity_boost: 0.80,
    style: 0.30,
    use_speaker_boost: true,
  },
  // Confident: for delivering financial insights or decisive answers
  confident: {
    stability: 0.82,
    similarity_boost: 0.82,
    style: 0.15,
    use_speaker_boost: true,
  },
  // Empathetic: for sensitive topics (debt stress, mood lows)
  empathetic: {
    stability: 0.65,
    similarity_boost: 0.78,
    style: 0.35,
    use_speaker_boost: true,
  },
};

// ─── Text pre-processing for Arabic TTS ──────────────────────────────────────
// ElevenLabs handles Arabic well with multilingual-v2, but benefits from
// explicit punctuation hints and removing markdown artifacts.
function prepareTextForTTS(text: string): string {
  return text
    // Remove markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g,    "$1")
    .replace(/`(.+?)`/g,      "$1")
    .replace(/#{1,6}\s/g,     "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    // Remove bullet points — TTS reads them as silence
    .replace(/^[-•–*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm,  "")
    // Collapse multiple newlines → single pause marker
    .replace(/\n{2,}/g, "، ")
    .replace(/\n/g, " ")
    // Cap at 500 chars for voice — cost control + optimal response length
    .trim()
    .slice(0, 500);
}

// ─── Brevity enforcer (voice mode: ≤ 200 chars ≈ 15 spoken words in Arabic) ──
function enforceVoiceBrevity(text: string, voiceMode: boolean): string {
  if (!voiceMode) return prepareTextForTTS(text);
  const cleaned = prepareTextForTTS(text);
  if (cleaned.length <= 220) return cleaned;

  // Try to cut at a natural sentence boundary
  const sentences = cleaned.split(/[.،؟!]/);
  let result = "";
  for (const s of sentences) {
    const candidate = result ? `${result}. ${s.trim()}` : s.trim();
    if (candidate.length <= 220) result = candidate;
    else break;
  }
  return result || cleaned.slice(0, 220);
}

// ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
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
        const audio = await elevenRes.arrayBuffer();
        return new Response(audio, {
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
