import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeadersFor } from "../_shared/cors.ts";

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authErr || !user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: cors });

  const userId = user.id;

  // ── Gather context in parallel ───────────────────────────────────────────────
  const [
    memoryRes, moodRes, tasksRes, habitsRes,
    finRes, goalsRes, portfolioRes,
  ] = await Promise.all([
    supabase.from('user_memories').select('category,content,importance').eq('user_id', userId).order('importance', { ascending: false }).limit(20),
    supabase.from('mood_logs').select('score,label,note,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(14),
    supabase.from('tasks').select('title,priority,status,due_date').eq('user_id', userId).neq('status','completed').order('due_date').limit(10),
    supabase.from('habits').select('name,frequency,streak,is_active').eq('user_id', userId).eq('is_active', true).limit(10),
    supabase.from('financial_data').select('type,amount,currency,category,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    supabase.from('goals').select('title,target_amount,saved_amount,target_date,status').eq('user_id', userId).eq('status','open').limit(5),
    supabase.from('portfolio_holdings').select('symbol,name,asset_type,quantity,avg_price,current_price').eq('user_id', userId).limit(15),
  ]);

  // ── Summarise financials (no advice — facts only) ────────────────────────────
  const txns = finRes.data ?? [];
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0);
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0);
  const savings = txns.filter(t => t.type === 'savings').reduce((s, t) => s + (t.amount ?? 0), 0);
  const catBreakdown: Record<string, number> = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    catBreakdown[t.category ?? 'other'] = (catBreakdown[t.category ?? 'other'] ?? 0) + t.amount;
  });
  const topCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const portfolio = portfolioRes.data ?? [];
  const portfolioValue = portfolio.reduce((s, h) => s + (h.quantity ?? 0) * (h.current_price ?? h.avg_price ?? 0), 0);
  const portfolioCost  = portfolio.reduce((s, h) => s + (h.quantity ?? 0) * (h.avg_price ?? 0), 0);

  // ── Mood trend ───────────────────────────────────────────────────────────────
  const moods = moodRes.data ?? [];
  const avgMood = moods.length ? (moods.reduce((s, m) => s + (m.score ?? 5), 0) / moods.length).toFixed(1) : null;
  const moodTrend = moods.length >= 2
    ? (moods[0].score > moods[moods.length - 1].score ? 'improving' : moods[0].score < moods[moods.length - 1].score ? 'declining' : 'stable')
    : 'unknown';

  const context = {
    memory: memoryRes.data ?? [],
    mood: { entries: moods.slice(0, 7), avg: avgMood, trend: moodTrend },
    tasks: tasksRes.data ?? [],
    habits: habitsRes.data ?? [],
    financial: {
      summary: { income, expenses, savings, net: income - expenses },
      top_expense_categories: topCats,
      recent_count: txns.length,
    },
    goals: goalsRes.data ?? [],
    portfolio: {
      holdings_count: portfolio.length,
      asset_types: [...new Set(portfolio.map(h => h.asset_type))],
      total_value: Math.round(portfolioValue),
      total_cost: Math.round(portfolioCost),
      pnl_pct: portfolioCost > 0 ? (((portfolioValue - portfolioCost) / portfolioCost) * 100).toFixed(1) : null,
    },
  };

  // ── Call Claude ──────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'no api key' }), { status: 500, headers: cors });

  const systemPrompt = `You are JOOD AI's recommendation engine. Generate 6–9 personalized Arabic recommendations for this user based on their real data.

Rules:
- Output ONLY a JSON array, no markdown, no explanation.
- Each item: { "kind": "finance|health|planning|spiritual|mood", "title": "short Arabic title ≤ 8 words", "body": "1–2 Arabic sentences with a specific insight or gentle nudge", "cta_label": "Arabic button label ≤ 4 words or null", "cta_target": "financial|planning|chat|null", "confidence": 0.0–1.0, "priority": 1–10 }
- finance: ONLY generate if finance.transactions_count > 0 OR portfolio.holdings_count > 0. If both are 0, skip finance entirely. Never invent numbers.
- health/mood: ONLY generate if mood_summary.total_logs > 0. If no logs, skip.
- planning: based on overdue tasks, upcoming deadlines, habit streaks.
- spiritual: based on memory/preferences about religious practice.
- Higher priority (8–10) for time-sensitive or high-importance items.
- Confidence reflects how much data supports the recommendation.
- Generate at least 1 recommendation per category IF AND ONLY IF real data exists for it.
- CRITICAL: Do not invent numbers, amounts, or events. If a field is 0 or null, treat that category as empty.`;

  const userPrompt = `User context (JSON):\n${JSON.stringify(context, null, 2)}\n\nGenerate recommendations now.`;

  let recs: Array<{
    kind: string; title: string; body: string;
    cta_label: string | null; cta_target: string | null;
    confidence: number; priority: number;
  }> = [];

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const json = await resp.json();
    const raw = json.content?.[0]?.text ?? '[]';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    recs = JSON.parse(cleaned);
    if (!Array.isArray(recs)) recs = [];
  } catch (e) {
    console.error('Claude parse error', e);
    return new Response(JSON.stringify({ error: 'generation_failed' }), { status: 500, headers: cors });
  }

  // ── Persist — replace non-dismissed recs older than 3 days ──────────────────
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('ai_recommendations')
    .delete()
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .lt('created_at', threeDaysAgo);

  const rows = recs.map(r => {
    const kind = r.kind ?? 'planning';
    return {
      user_id: userId,
      scope: kind,  // required not-null column
      kind,
      title: r.title ?? '',
      body: r.body ?? null,
      cta_label: r.cta_label ?? null,
      cta_target: r.cta_target ?? null,
      confidence: Math.min(1, Math.max(0, r.confidence ?? 0.7)),
      priority: Math.min(10, Math.max(1, Math.round(r.priority ?? 5))),
    };
  });

  if (rows.length > 0) {
    await supabase.from('ai_recommendations').insert(rows);
  }

  return new Response(JSON.stringify({ generated: rows.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
