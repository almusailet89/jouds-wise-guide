import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { GoogleGenAI, Modality } from "npm:@google/genai@3.4.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { getPlanTier } from "../_shared/rate-limit.ts";
import { LIVE_FUNCTION_DECLARATIONS } from "../_shared/live-tool-declarations.ts";

// ─── Gemini Live: short-lived session token ──────────────────────────────────
//
// Authenticates the user, checks their monthly voice minutes, then mints a
// one-use Gemini ephemeral token locked to Jood's model, voice, persona and
// tools. The browser connects straight to Gemini Live with that token; the
// GEMINI_API_KEY never leaves the server, and the client cannot swap in a
// different model or prompt.
//
// Env:
//   GEMINI_API_KEY              required
//   GEMINI_LIVE_MODEL           default gemini-3.8-live
//   GEMINI_LIVE_VOICE           default Sulafat (warm female)
//   VOICE_MINUTES_BASE          default 60   (monthly, beta/free)
//   VOICE_MINUTES_SIGNATURE     default 150  (monthly, Signature plan)
// ═══════════════════════════════════════════════════════════════════════════════

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

function personaPrompt(opts: {
  name: string | null;
  gender: string | null;
  lang: "ar" | "en";
  nickname: string | null;
  style: string | null;
  timezone: string;
}) {
  const now = new Date().toLocaleString("en-GB", { timeZone: opts.timezone, dateStyle: "full", timeStyle: "short" });
  const addressing = opts.gender === "female"
    ? "المستخدمة أنثى: خاطبيها بصيغة المؤنث دائماً (تبين، عندك، سوّيتي)."
    : opts.gender === "male"
      ? "المستخدم ذكر: خاطبيه بصيغة المذكر دائماً (تبي، عندك، سوّيت)."
      : "إذا ما تعرفين جنس المستخدم، استخدمي صيغة محايدة قدر الإمكان.";

  return `أنتِ "جود" — مساعدة شخصية سعودية ذكية، تتكلمين بصوت امرأة سعودية أنيقة وهادئة وواثقة.
${opts.nickname ? `المستخدم يناديك "${opts.nickname}".` : ""}
${opts.name ? `اسم المستخدم: ${opts.name}.` : ""}
الوقت الحالي عند المستخدم: ${now} (${opts.timezone}).

طريقة الكلام:
• تكلمي باللهجة السعودية النجدية البيضاء الراقية — دافئة وطبيعية مثل إنسانة حقيقية، مو روبوت ولا فصحى ثقيلة.
• إذا تكلم المستخدم إنجليزي، ردّي بإنجليزي دافئ ومهني. لغة التطبيق المفضلة: ${opts.lang === "ar" ? "العربية" : "English"}.
• ${addressing}
• هذه محادثة صوتية: جملة أو جملتين بالكثير، بدون قوائم أو رموز أو روابط. الأرقام تقال بطريقة طبيعية ("ألفين وخمسمية ريال").
• ابدئي بالمضمون مباشرة. لا تقولي "بالتأكيد" أو "Sure".
• عبارات طبيعية عند الحاجة: "سم"، "أبشر/أبشري"، "تم"، "الله يعطيك العافية".
${opts.style === "concise" ? "• المستخدم يفضّل الإيجاز الشديد." : opts.style === "detailed" ? "• المستخدم يحب شوية تفصيل، بس خليه مسموع ومريح." : ""}

الأدوات:
• عندك أدوات تقرأ وتكتب بيانات المستخدم (مهام، مواعيد، مصاريف، أهداف، مزاج، ذاكرة). استخدميها بدل التخمين.
• في بداية المكالمة إذا سأل عن يومه أو قال صباح الخير، استدعي get_daily_briefing.
• قبل ما تسجلين مبلغ أو موعد، تأكدي من الرقم أو الوقت إذا كان غير واضح.
• إذا شارك المستخدم معلومة دائمة عن نفسه، احفظيها بأداة remember بدون ما تعلنين ذلك بطريقة مزعجة.

حدود:
• لا تعطين نصيحة استثمارية شخصية ملزمة؛ قدّمي معلومات عامة واقترحي استشارة مختص عند الحاجة.
• لا تدّعين أنك شخص حقيقي معروف. أنتِ جود.`;
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json({ error: "Invalid token" }, 401, corsHeaders);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 503, corsHeaders);

    // ── Monthly voice minutes ────────────────────────────────────────────────
    const tier = await getPlanTier(supabase, user.id);
    const baseMinutes = Number(Deno.env.get("VOICE_MINUTES_BASE") ?? 60);
    const signatureMinutes = Number(Deno.env.get("VOICE_MINUTES_SIGNATURE") ?? 150);
    const limitSeconds = tier.isAdmin ? null : (tier.isSignature ? signatureMinutes : baseMinutes) * 60;

    const periodMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: usageRow } = await supabase
      .from("voice_usage").select("seconds_used")
      .eq("user_id", user.id).eq("period_month", periodMonth).maybeSingle();
    const usedSeconds = usageRow?.seconds_used ?? 0;
    const remainingSeconds = limitSeconds === null ? null : Math.max(limitSeconds - usedSeconds, 0);
    if (remainingSeconds !== null && remainingSeconds <= 0) {
      return json({ error: "minutes_exhausted", used_seconds: usedSeconds, limit_seconds: limitSeconds }, 429, corsHeaders);
    }

    // ── Persona context ──────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, gender, app_language, jood_nickname, preferred_response_style, timezone")
      .eq("user_id", user.id).maybeSingle();

    let body: { lang?: string } = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }
    const lang: "ar" | "en" = (body.lang ?? profile?.app_language) === "en" ? "en" : "ar";
    let timezone = profile?.timezone || "Asia/Riyadh";
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { timezone = "Asia/Riyadh"; }

    const model = Deno.env.get("GEMINI_LIVE_MODEL") ?? "gemini-3.8-live";
    const voice = Deno.env.get("GEMINI_LIVE_VOICE") ?? "Sulafat";

    const liveConfig = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: {
        parts: [{
          text: personaPrompt({
            name: profile?.display_name ?? null,
            gender: profile?.gender ?? null,
            lang,
            nickname: profile?.jood_nickname ?? null,
            style: profile?.preferred_response_style ?? null,
            timezone,
          }),
        }],
      },
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: LIVE_FUNCTION_DECLARATIONS }],
      // sessionResumption is left unlocked: the app sends the resume handle on reconnect.
      contextWindowCompression: { slidingWindow: {} },
    };

    // Session tokens are valid for the call (max 30 min); a new session must start within 60s.
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60_000).toISOString();
    const newSessionExpireTime = new Date(now + 60_000).toISOString();

    // Google has documented ephemeral tokens under both v1beta and v1alpha; try the
    // newer one first and tell the client which version issued the token.
    let token: { name?: string } | null = null;
    let apiVersion = "v1beta";
    let lastError: unknown = null;
    for (const version of ["v1beta", "v1alpha"]) {
      try {
        const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: version } });
        token = await ai.authTokens.create({
          config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: { model, config: liveConfig },
            lockAdditionalFields: [],
            httpOptions: { apiVersion: version },
          },
        });
        apiVersion = version;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!token?.name) {
      console.error("gemini-live-token: token creation failed", lastError);
      return json({ error: "token_failed" }, 502, corsHeaders);
    }

    return json({
      token: token.name,
      model,
      api_version: apiVersion,
      remaining_seconds: remainingSeconds,
      limit_seconds: limitSeconds,
      session_max_seconds: 30 * 60,
    }, 200, corsHeaders);
  } catch (err) {
    console.error("gemini-live-token error:", err);
    return json({ error: "internal" }, 500, corsHeaders);
  }
});
