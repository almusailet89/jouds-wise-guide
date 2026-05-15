import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─────────────────────────────────────────────────────────────────────────────
// Additive Azure TTS branch.
// Activated ONLY when:
//   - request body includes `provider: "azure"`
//   - `language: "ar"` (Azure path is Arabic-only for this voice)
//   - `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are set as secrets
// Otherwise the legacy OpenAI branch runs exactly as before — same input
// fields, same output JSON, same error wording. Bug-free legacy callers see
// zero change.
// ─────────────────────────────────────────────────────────────────────────────
async function generateAzureSpeech(text: string, voice: string): Promise<ArrayBuffer> {
  const key    = Deno.env.get('AZURE_SPEECH_KEY')!;
  const region = Deno.env.get('AZURE_SPEECH_REGION') ?? 'uaenorth';
  const url    = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='ar-SA'><voice name='${voice}'>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</voice></speak>`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type':              'application/ssml+xml',
      'X-Microsoft-OutputFormat':  'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent':                'jood-ai',
    },
    body: ssml,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure TTS failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return await res.arrayBuffer();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // NOTE: `provider` and `language` are NEW optional fields. When absent, the
    // legacy OpenAI path runs verbatim. Default values were chosen so the
    // request shape is byte-identical to today's: { text, voice }.
    const { text, voice = 'nova', provider, language } = await req.json()

    if (!text) {
      console.error('No text provided in request')
      throw new Error('Text is required')
    }

    console.log('Generating speech for text length:', text.length, 'with voice:', voice)

    // ─── Additive Azure branch — only when all gate conditions are met ──────
    if (provider === 'azure' && language === 'ar' && Deno.env.get('AZURE_SPEECH_KEY')) {
      const azureVoice = voice && voice.startsWith('ar-SA') ? voice : 'ar-SA-ZariyahNeural';
      const azureBuf = await generateAzureSpeech(text, azureVoice);
      const azureB64 = btoa(String.fromCharCode(...new Uint8Array(azureBuf)));
      return new Response(
        JSON.stringify({ audioContent: azureB64, voice: azureVoice, text, provider: 'azure' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── LEGACY OPENAI BRANCH (unchanged — runs when no provider param) ─────
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Generate speech from text using OpenAI TTS
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: voice, // nova, alloy, echo, fable, onyx, shimmer
        response_format: 'mp3',
        speed: 1.0,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI TTS API error:', response.status, response.statusText, errorText)
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: { message: errorText } };
      }
      throw new Error(error.error?.message || `Failed to generate speech (${response.status}): ${errorText}`)
    }

    // Convert audio buffer to base64
    const arrayBuffer = await response.arrayBuffer()
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: voice,
        text: text
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})