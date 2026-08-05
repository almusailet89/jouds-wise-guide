import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

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
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not configured");

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
    const riyadhHour = (new Date().getUTCHours() + 3) % 24;
    const period = riyadhHour < 12 ? 'morning' : 'midday';

    // ── Return existing brief only if same period today ────────────────────
    if (!force) {
      const { data: existing } = await supabase
        .from('daily_briefs')
        .select('*')
        .eq('user_id', user.id)
        .eq('brief_date', today)
        .maybeSingle();

      if (existing && (existing as any).meta?.period === period) {
        return new Response(JSON.stringify({ brief: existing, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Gather context from real app data ──────────────────────────────────
    const [profileRes, memoriesRes, eventsRes, tasksRes, financeRes, prayer] = await Promise.all([
      supabase.from('profiles').select('display_name, base_currency').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_user_memories_for_prompt', { p_user_id: user.id, p_limit: 8 }),
      supabase.from('events').select('title, start_at, end_at')
        .eq('user_id', user.id)
        .gte('start_at', `${today}T00:00:00`)
        .lte('start_at', `${today}T23:59:59`)
        .order('start_at')
        .limit(8),
      supabase.from('tasks').select('title, due_date, priority, status')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .lte('due_date', today)
        .order('priority', { ascending: false })
        .limit(5),
      supabase.from('financial_data').select('type, amount, currency, category, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      fetchPrayerTimes(),
    ]);

    const profile   = profileRes.data;
    const memories  = (memoriesRes.data ?? []) as any[];
    const events    = eventsRes.data ?? [];
    const tasks     = tasksRes.data ?? [];
    const recentFin = financeRes.data ?? [];

    const displayName = profile?.display_name?.trim() || '';
    const currency    = profile?.base_currency ?? 'SAR';
    const { greeting: greetingAr } = timeBasedGreeting('ar');
    const { greeting: greetingEn } = timeBasedGreeting('en');

    // ── Build context strings from real data ───────────────────────────────
    // Next prayer
    let prayerLineAr = '';
    let prayerLineEn = '';
    if (prayer) {
      const nowMin = ((new Date().getUTCHours() + 3) % 24) * 60 + new Date().getUTCMinutes();
      const slots: Array<[string, string, string]> = [
        ['الفجر','Fajr',prayer.Fajr],['الظهر','Dhuhr',prayer.Dhuhr],
        ['العصر','Asr',prayer.Asr],['المغرب','Maghrib',prayer.Maghrib],['العشاء','Isha',prayer.Isha],
      ];
      const next = slots.find(([,,t]) => { if(!t) return false; const [h,m]=t.split(':').map(Number); return h*60+m > nowMin; });
      if (next) { prayerLineAr = `${next[0]} ${next[2]}`; prayerLineEn = `${next[1]} at ${next[2]}`; }
    }

    // Events: "title at HH:MM" sorted
    const eventsData = events.map((e: any) => {
      const time = e.start_at ? new Date(e.start_at).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit', hour12: false, timeZone:'Asia/Riyadh' }) : '';
      return time ? `${e.title} (${time})` : e.title;
    });

    // Tasks overdue or due today
    const taskData = tasks.map((t: any) => t.title);

    // Finance: only notable (large amounts or alerts)
    const financeData = recentFin.slice(0, 3).map((f: any) =>
      `${f.type === 'expense' ? 'مصروف' : f.type === 'income' ? 'دخل' : f.type}: ${f.amount} ${currency}${f.description ? ` (${f.description})` : ''}`
    );

    // User name from memories if not in profile
    const nameFromMemory = memories.find((m: any) => m.kind === 'identity')?.content ?? '';

    const hasAnyData = eventsData.length > 0 || taskData.length > 0;

    // ── Fallback if no real data ───────────────────────────────────────────
    if (!hasAnyData && taskData.length === 0) {
      const nameLabel = displayName || '';
      const fallbackAr = `${greetingAr}${nameLabel ? `، ${nameLabel}` : ''}. ما عندك مواعيد أو مهام مسجلة اليوم. إذا تبغى أرتب يومك، ناديني: يا جود، وبجهز لك جدول واضح.`;
      const fallbackEn = `${greetingEn}${nameLabel ? `, ${nameLabel}` : ''}. No events or tasks recorded for today. Say "Hey Jood, organise my day" and I'll set things up.`;
      const fallbackRow = {
        user_id: user.id, brief_date: today,
        greeting: `${greetingAr}${nameLabel ? `، ${nameLabel}` : ''}`,
        content: 'ما عندك مواعيد أو مهام مسجلة اليوم.',
        highlights: [] as any[],
        suggested_action: 'إذا تبغى أرتب يومك، ناديني: يا جود',
        meta: { model:'fallback', period, prayer_ar: prayerLineAr, prayer_en: prayerLineEn,
                greeting_en: `${greetingEn}${nameLabel ? `, ${nameLabel}` : ''}`,
                content_en: "No events or tasks recorded for today.",
                action_en: 'Say "Hey Jood, organise my day"', full_ar: fallbackAr, full_en: fallbackEn },
      };
      await supabase.from('daily_briefs').upsert(fallbackRow, { onConflict: 'user_id,brief_date' });
      return new Response(JSON.stringify({ brief: { ...fallbackRow, id: null }, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Prompt ─────────────────────────────────────────────────────────────
    const CTA_AR = 'إذا تبغى أعدل أي شيء، ناديني: يا جود، وبحدّث لك جدولك.';
    const CTA_EN = 'To update anything, just say: "Hey Jood" and I\'ll adjust your schedule.';

    const SYSTEM_PROMPT = `You are Jood — a Saudi AI executive secretary. Write a concise bilingual daily brief using ONLY the data provided. Never invent events, tasks, or advice.

Rules:
- Arabic content: max 60 words, no bullet lists, natural Saudi Arabic, secretary tone
- English content: max 45 words, direct, executive
- Only mention what is in the context — if no events/tasks, say so plainly
- DO NOT say "I remember" or reference memories explicitly
- The brief must end with exactly these CTAs (append them to content):
  AR: "${CTA_AR}"
  EN: "${CTA_EN}"

Output valid JSON:
{
  "greeting_ar": "${greetingAr}${displayName ? `، ${displayName}` : ''}",
  "greeting_en": "${greetingEn}${displayName ? `, ${displayName}` : ''}",
  "content_ar": "brief in Arabic ending with CTA",
  "content_en": "brief in English ending with CTA",
  "highlights": [{"kind":"prayer|finance|event|task","text_ar":"...","text_en":"..."}]
}`;

    const USER_PROMPT = `Live data for today (${today}):

EVENTS (calendar): ${eventsData.length ? eventsData.join(' | ') : 'none'}
TASKS DUE: ${taskData.length ? taskData.join(' | ') : 'none'}
FINANCE (recent): ${financeData.length ? financeData.join(' | ') : 'none'}
NEXT PRAYER: ${prayerLineAr || 'none'}
USER NAME: ${displayName || nameFromMemory || '(unknown)'}
PERIOD: ${period}

Write the bilingual brief now. Use only the data above.`;

    // ── Call Claude (same key as all other functions) ──────────────────────
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: USER_PROMPT }],
      }),
    });

    if (!aiRes.ok) throw new Error(`Claude failed: ${await aiRes.text()}`);

    const aiJson = await aiRes.json();
    let parsed: any;
    try {
      const raw = aiJson.content?.[0]?.text ?? '{}';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Brief generator returned non-JSON');
    }

    const briefRow = {
      user_id:          user.id,
      brief_date:       today,
      greeting:         parsed.greeting_ar ?? `${greetingAr}${displayName ? `، ${displayName}` : ''}`,
      content:          parsed.content_ar  ?? 'موجز اليوم غير متاح.',
      highlights:       Array.isArray(parsed.highlights) ? parsed.highlights : [],
      suggested_action: CTA_AR,
      meta: {
        model: 'claude-haiku-4-5-20251001', period,
        events_today: events.length, tasks_today: tasks.length,
        prayer_ar: prayerLineAr, prayer_en: prayerLineEn,
        greeting_en: parsed.greeting_en ?? `${greetingEn}${displayName ? `, ${displayName}` : ''}`,
        content_en:  parsed.content_en  ?? "Today's brief is unavailable.",
        action_en:   CTA_EN,
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
