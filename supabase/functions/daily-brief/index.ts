import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Riyadh-local date (YYYY-MM-DD) ──────────────────────────────────────────
function riyadhDate(): string {
  const utc = new Date();
  const riyadh = new Date(utc.getTime() + 3 * 60 * 60 * 1000);
  return riyadh.toISOString().slice(0, 10);
}

// ─── Hijri date ───────────────────────────────────────────────────────────────
function hijriToday(lang: string): string {
  try {
    const locale = lang === 'en' ? 'en-SA-u-ca-islamic' : 'ar-SA-u-ca-islamic';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

// ─── Greeting selector by time of day (Riyadh) ──────────────────────────────
function timeBasedGreeting(lang: string): { greeting: string; partOfDay: string } {
  const utc = new Date();
  const riyadhHour = (utc.getUTCHours() + 3) % 24;

  if (lang === 'en') {
    if (riyadhHour < 5)  return { greeting: "Good night",      partOfDay: "late night" };
    if (riyadhHour < 11) return { greeting: "Good morning",    partOfDay: "morning" };
    if (riyadhHour < 14) return { greeting: "Good day",        partOfDay: "late morning" };
    if (riyadhHour < 17) return { greeting: "Good afternoon",  partOfDay: "afternoon" };
    if (riyadhHour < 21) return { greeting: "Good evening",    partOfDay: "evening" };
    return                      { greeting: "Good night",      partOfDay: "late evening" };
  }

  if (riyadhHour < 5)  return { greeting: "ليلة هادئة",  partOfDay: "ليل متأخر" };
  if (riyadhHour < 11) return { greeting: "صباح الخير",  partOfDay: "صباح" };
  if (riyadhHour < 14) return { greeting: "نهارك سعيد",  partOfDay: "ضحى" };
  if (riyadhHour < 17) return { greeting: "مساء النور",  partOfDay: "ظهر" };
  if (riyadhHour < 21) return { greeting: "مساء الخير",  partOfDay: "مغرب" };
  return                      { greeting: "ليلة طيبة",   partOfDay: "مساء متأخر" };
}

// ─── Fetch prayer times from Aladhan (Riyadh) ───────────────────────────────
async function fetchPrayerTimes(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      'https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4',
      { signal: AbortSignal.timeout(3000) },
    );
    const json = await res.json();
    return json?.data?.timings ?? null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse params ───────────────────────────────────────────────────────
    let force = false;
    let lang  = 'ar';
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = body.force ?? false;
        lang  = body.lang  ?? 'ar';
      } catch { /* empty body OK */ }
    }

    const today = riyadhDate();

    // ── Return existing brief if already generated for today in this language
    if (!force) {
      const { data: existing } = await supabase
        .from('daily_briefs')
        .select('*')
        .eq('user_id', user.id)
        .eq('brief_date', today)
        .maybeSingle();

      // Serve cache — brief is now always bilingual, no lang check needed
      if (existing) {
        return new Response(JSON.stringify({ brief: existing, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Gather context ─────────────────────────────────────────────────────
    const [profileRes, memoriesRes, eventsRes, financeRes, prayer] = await Promise.all([
      supabase.from('profiles').select('display_name, base_currency, risk_profile').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_user_memories_for_prompt', { p_user_id: user.id, p_limit: 10 }),
      supabase.from('events').select('title, start_at').eq('user_id', user.id)
        .gte('start_at', `${today}T00:00:00`).lte('start_at', `${today}T23:59:59`).limit(5),
      supabase.from('financial_data').select('type, amount, currency, category, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      fetchPrayerTimes(),
    ]);

    const profile   = profileRes.data;
    const memories  = (memoriesRes.data ?? []) as any[];
    const events    = eventsRes.data ?? [];
    const recentFin = financeRes.data ?? [];

    const { greeting, partOfDay } = timeBasedGreeting(lang);
    const hijri       = hijriToday(lang);
    const displayName = profile?.display_name?.trim() || '';

    // Finance snapshot
    let totalIncome  = 0;
    let totalExpense = 0;
    for (const e of recentFin) {
      const amt = Number(e.amount) || 0;
      if (e.type === 'income')  totalIncome  += amt;
      if (e.type === 'expense') totalExpense += amt;
    }

    // Memory string
    const memoryLines = memories.length
      ? memories.map((m: any) => `- (${m.kind}) ${m.content}`).join('\n')
      : lang === 'en' ? '(No memories yet — first meeting)' : '(لا توجد ذكريات بعد — أول لقاء)';

    // Prayer line
    let prayerLine = '';
    if (prayer) {
      const utc = new Date();
      const nowMin = ((utc.getUTCHours() + 3) % 24) * 60 + utc.getUTCMinutes();
      const order: Array<[string, string]> = lang === 'en'
        ? [['Fajr', prayer.Fajr], ['Dhuhr', prayer.Dhuhr], ['Asr', prayer.Asr], ['Maghrib', prayer.Maghrib], ['Isha', prayer.Isha]]
        : [['الفجر', prayer.Fajr], ['الظهر', prayer.Dhuhr], ['العصر', prayer.Asr], ['المغرب', prayer.Maghrib], ['العشاء', prayer.Isha]];
      const next = order.find(([, t]) => {
        if (!t) return false;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m > nowMin;
      });
      if (next) prayerLine = lang === 'en'
        ? `Next prayer: ${next[0]} at ${next[1]}`
        : `الصلاة القادمة: ${next[0]} الساعة ${next[1]}`;
    }

    // Events line
    const eventLine = events.length
      ? lang === 'en'
        ? `Today's events: ${events.map((e: any) => e.title).join(', ')}`
        : `اليوم لديكِ: ${events.map((e: any) => e.title).join('، ')}`
      : '';

    // Finance line
    const currency = profile?.base_currency ?? 'SAR';
    const financeLine = (totalIncome || totalExpense)
      ? lang === 'en'
        ? `Recent finances — income: ${totalIncome.toFixed(0)} / expenses: ${totalExpense.toFixed(0)} ${currency}`
        : `آخر التحركات المالية — دخل: ${totalIncome.toFixed(0)} / مصروف: ${totalExpense.toFixed(0)} ${currency}`
      : '';

    // ── Build bilingual prompt (always generates AR + EN) ─────────────────
    const { greeting: greetingAr } = timeBasedGreeting('ar');
    const { greeting: greetingEn } = timeBasedGreeting('en');

    const SYSTEM_PROMPT = `You are Jood — a premium Saudi AI executive assistant. Generate a short bilingual daily brief (Arabic + English) for the user. Always output BOTH languages.

Rules:
- Arabic: warm, personal, 30-50 words, no lists
- English: direct, executive, 25-40 words, no lists
- Connect user memories to today naturally — do NOT say "I remember"
- Suggest one clear closing action
- Temperature/weather if available — include it naturally
- No Hijri date — keep it clean and timeless

Output valid JSON in exactly this format:
{
  "greeting_ar": "${greetingAr}${displayName ? `، ${displayName}` : ''}",
  "greeting_en": "${greetingEn}${displayName ? `, ${displayName}` : ''}",
  "content_ar": "Arabic brief without greeting (2-3 sentences)",
  "content_en": "English brief without greeting (2-3 sentences)",
  "highlights": [{"kind": "prayer|finance|memory|event|tip", "text_ar": "...", "text_en": "..."}],
  "action_ar": "Arabic closing action suggestion",
  "action_en": "English closing action suggestion"
}`;

    // Build prayer highlights for both languages
    let prayerLineAr = '';
    let prayerLineEn = '';
    if (prayer) {
      const utc2 = new Date();
      const nowMin2 = ((utc2.getUTCHours() + 3) % 24) * 60 + utc2.getUTCMinutes();
      const orderAr: Array<[string, string]> = [['الفجر', prayer.Fajr], ['الظهر', prayer.Dhuhr], ['العصر', prayer.Asr], ['المغرب', prayer.Maghrib], ['العشاء', prayer.Isha]];
      const orderEn: Array<[string, string]> = [['Fajr', prayer.Fajr], ['Dhuhr', prayer.Dhuhr], ['Asr', prayer.Asr], ['Maghrib', prayer.Maghrib], ['Isha', prayer.Isha]];
      const nextAr = orderAr.find(([, t]) => { if (!t) return false; const [h, m] = t.split(':').map(Number); return h * 60 + m > nowMin2; });
      const nextEn = orderEn.find(([, t]) => { if (!t) return false; const [h, m] = t.split(':').map(Number); return h * 60 + m > nowMin2; });
      if (nextAr) prayerLineAr = `الصلاة القادمة: ${nextAr[0]} ${nextAr[1]}`;
      if (nextEn) prayerLineEn = `Next prayer: ${nextEn[0]} at ${nextEn[1]}`;
    }

    const USER_PROMPT = `User context (bilingual brief needed):

Name: ${displayName || '(not introduced yet)'}
Time of day: ${partOfDay}
${prayerLineEn ? `Prayer: ${prayerLineEn}` : ''}
Currency: ${currency}

Memories:
${memoryLines}

${eventLine}
${financeLine}

Generate the bilingual JSON brief now.`;

    // ── Call OpenAI ────────────────────────────────────────────────────────
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: USER_PROMPT },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI failed: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const raw    = aiJson.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error('Brief generator returned non-JSON');
    }

    const briefRow = {
      user_id:          user.id,
      brief_date:       today,
      // Primary fields — Arabic (default display language)
      greeting:         parsed.greeting_ar  ?? `${greetingAr}${displayName ? `، ${displayName}` : ''}`,
      content:          parsed.content_ar   ?? 'موجز اليوم غير متاح.',
      highlights:       Array.isArray(parsed.highlights) ? parsed.highlights : [],
      suggested_action: parsed.action_ar    ?? null,
      meta: {
        model:         'gpt-4o-mini',
        memories_used: memories.length,
        events_today:  events.length,
        has_prayer:    !!prayer,
        part_of_day:   partOfDay,
        prayer_ar:     prayerLineAr,
        prayer_en:     prayerLineEn,
        // English bilingual fields
        greeting_en:   parsed.greeting_en  ?? `${greetingEn}${displayName ? `, ${displayName}` : ''}`,
        content_en:    parsed.content_en   ?? "Today's brief is unavailable.",
        action_en:     parsed.action_en    ?? null,
      },
    };

    // Upsert — replaces any existing brief for this user+date (incl. lang switch)
    const { data: saved, error: saveErr } = await supabase
      .from('daily_briefs')
      .upsert(briefRow, { onConflict: 'user_id,brief_date' })
      .select('*')
      .single();

    if (saveErr) {
      console.error('[daily-brief] save failed:', saveErr);
      return new Response(JSON.stringify({ brief: { ...briefRow, id: null }, cached: false, save_error: saveErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief: saved, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error('[daily-brief] error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
