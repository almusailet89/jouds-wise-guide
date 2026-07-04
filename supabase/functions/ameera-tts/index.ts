import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

// Ameera Al-Taweel voice profile
// Primary: Azure Neural ar-SA-ZariyahNeural
// Fallback: OpenAI TTS nova (English)

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, emotion = "neutral", language = "ar" } = await req.json();

    if (!text) return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const azureKey    = Deno.env.get("AZURE_SPEECH_KEY");
    const azureRegion = Deno.env.get("AZURE_SPEECH_REGION") ?? "uaenorth";

    // Emotion → SSML prosody mapping (Ameera profile from spec)
    const prosodyMap: Record<string, string> = {
      neutral:    'rate="0.95" pitch="+0st"',
      warm:       'rate="0.90" pitch="+1st"',
      confident:  'rate="1.00" pitch="-1st"',
      empathetic: 'rate="0.88" pitch="+2st"',
    };
    const prosody = prosodyMap[emotion] ?? prosodyMap.neutral;

    const voice = language === "ar" ? "ar-SA-ZariyahNeural" : "en-US-JennyNeural";

    const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language === "ar" ? "ar-SA" : "en-US"}">
  <voice name="${voice}">
    <prosody ${prosody}>
      ${text}
    </prosody>
  </voice>
</speak>`.trim();

    // Try Azure first
    if (azureKey) {
      const azureRes = await fetch(
        `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
            "User-Agent": "JoodAI",
          },
          body: ssml,
        }
      );

      if (azureRes.ok) {
        const audio = await azureRes.arrayBuffer();
        return new Response(audio, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "X-Voice": voice,
            "X-Engine": "azure-neural",
          },
        });
      }
    }

    // Fallback: OpenAI TTS
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("No TTS engine configured. Set AZURE_SPEECH_KEY or OPENAI_API_KEY.");

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova",
        input: text,
        speed: 0.95,
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
        "Content-Type": "audio/mpeg",
        "X-Voice": "nova",
        "X-Engine": "openai-fallback",
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
