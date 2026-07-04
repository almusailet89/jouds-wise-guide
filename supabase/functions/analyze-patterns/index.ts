import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_SESSIONS        = 20;  // don't run until user has this many sessions
const RE_ANALYZE_AFTER    = 10;  // re-run only after this many new sessions since last run
const MIN_DISTINCT_SESSIONS = 3; // a pattern must span at least this many sessions to be valid

const VALID_CATEGORIES = [
  'identity','work','family','financial','health','religion',
  'routine','goals','interests','relationships','preferences','pain_points',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let user_id = '';
  try {
    ({ user_id } = await req.json());
    if (!user_id) throw new Error('user_id required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY not set');

    // ── Gate 1: session count ────────────────────────────────────────────────
    const { count: sessionCount } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    const totalSessions = sessionCount ?? 0;
    if (totalSessions < MIN_SESSIONS) {
      console.log(`[analyze-patterns] skip: ${totalSessions} sessions < ${MIN_SESSIONS} minimum`);
      return ok({ skipped: `${totalSessions}/${MIN_SESSIONS} sessions` });
    }

    // ── Gate 2: enough new sessions since last run ───────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_pattern_analysis_at, pattern_analysis_session_count')
      .eq('user_id', user_id)
      .maybeSingle();

    const lastCount = profile?.pattern_analysis_session_count ?? 0;
    const sessionsSinceLast = totalSessions - lastCount;

    if (lastCount > 0 && sessionsSinceLast < RE_ANALYZE_AFTER) {
      console.log(`[analyze-patterns] skip: only ${sessionsSinceLast} new sessions since last run`);
      return ok({ skipped: `${sessionsSinceLast}/${RE_ANALYZE_AFTER} new sessions` });
    }

    // ── Fetch recent sessions ────────────────────────────────────────────────
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!sessions?.length) return ok({ skipped: 'no sessions found' });

    const sessionIds = sessions.map((s: any) => s.id);

    // ── Fetch user messages across those sessions ────────────────────────────
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('content, role, session_id, created_at')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!messages?.length) return ok({ skipped: 'no user messages' });

    // ── Group by session ─────────────────────────────────────────────────────
    const bySession: Record<string, string[]> = {};
    for (const msg of messages as any[]) {
      if (!bySession[msg.session_id]) bySession[msg.session_id] = [];
      bySession[msg.session_id].push((msg.content ?? '').slice(0, 300));
    }

    const distinctSessions = Object.keys(bySession).length;
    if (distinctSessions < MIN_DISTINCT_SESSIONS) {
      return ok({ skipped: `only ${distinctSessions} distinct sessions in data` });
    }

    // ── Load existing patterns to avoid re-saving duplicates ─────────────────
    const { data: existingPatterns } = await supabase
      .from('user_memories')
      .select('content')
      .eq('user_id', user_id)
      .eq('kind', 'pattern')
      .eq('active', true);

    const existingStr = (existingPatterns as any[])?.length
      ? `\nأنماط محفوظة مسبقاً (لا تُكررها):\n${(existingPatterns as any[]).map((p: any) => `- ${p.content}`).join('\n')}`
      : '';

    // ── Format chat history for analysis ────────────────────────────────────
    const sessionBlocks = Object.entries(bySession)
      .slice(0, 30)
      .map(([_, msgs], i) => `[جلسة ${i + 1}]\n${msgs.slice(0, 5).join('\n')}`)
      .join('\n\n');

    // ── Call GPT-4o-mini for pattern extraction ──────────────────────────────
    const prompt = `أنت تحلل تاريخ محادثات مستخدم مع مساعد ذكي لاستخلاص أنماط سلوكية متكررة وحقيقية.

قواعد صارمة — الالتزام بها إلزامي:
1. النمط يجب أن يظهر في ${MIN_DISTINCT_SESSIONS} جلسات مختلفة على الأقل، وليس 3 رسائل في نفس الجلسة.
2. لا تستنتج من ذكر واحد فقط. جملة "أعمل في شركة X" مذكورة مرة = حقيقة وليست نمطاً.
3. إذا لم تجد نمطاً واضحاً بثقة عالية، أرجع [] فارغة بدون تفسير.
4. الأنماط تتعلق بالسلوك والتكرار الفعلي فقط، لا بالتصريحات أو الحقائق.
5. الحد الأقصى 3 أنماط فقط في المرة الواحدة.
6. لا تخمن ولا تتوسع. كن دقيقاً وواقعياً فقط.
7. كل نمط يجب أن يكون مدعوماً بأدلة موجودة فعلاً في النص.${existingStr}

أمثلة أنماط صحيحة ومقبولة:
- "يسأل عن الاستثمار والأسهم في عطل نهاية الأسبوع بشكل متكرر"
- "يبدأ معظم محادثاته في الصباح الباكر"
- "يفضل الإنجليزية في المواضيع المالية والتقنية والعربية للمواضيع الشخصية"
- "يراجع مهامه المتأخرة في بداية كل أسبوع"

ما يجب تجنبه تماماً:
- أي شيء ذُكر في جلسة واحدة فقط
- إعادة صياغة ما قاله المستخدم صراحةً في رسالة واحدة
- استنتاجات نفسية أو شخصية لا دليل عليها في النص

تاريخ المحادثات (${distinctSessions} جلسة مختلفة من أصل ${totalSessions}):
${sessionBlocks}

أرجع JSON فقط بدون أي نص قبله أو بعده:
[{"content": "وصف النمط السلوكي بوضوح", "category": "routine|interests|preferences|financial|health|goals|work|family|religion|identity|relationships|pain_points", "importance": 0.5}]

إذا لم تجد أنماطاً موثوقة وواضحة: []`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const rawText = (aiData?.choices?.[0]?.message?.content ?? '[]').trim();

    let patterns: Array<{ content: string; category: string; importance: number }> = [];
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) patterns = JSON.parse(match[0]);
    } catch {
      patterns = [];
    }

    // ── Save valid, non-duplicate patterns ───────────────────────────────────
    let saved = 0;
    for (const p of patterns.slice(0, 3)) {
      if (!p.content?.trim() || !VALID_CATEGORIES.includes(p.category)) continue;

      const isDupe = (existingPatterns as any[])?.some((ep: any) =>
        ep.content.slice(0, 40).trim() === p.content.slice(0, 40).trim()
      );
      if (isDupe) continue;

      const { error } = await supabase.from('user_memories').insert({
        user_id,
        kind: 'pattern',
        category: p.category,
        content: p.content.trim().slice(0, 400),
        // Inferred patterns start with lower confidence than user-declared facts (1.0)
        importance:  Math.min(Math.max(Number(p.importance) || 0.5, 0.3), 0.8),
        confidence:  0.5,
        active:      true,
        is_template: false,
      });

      if (!error) saved++;
    }

    // ── Record analysis run ──────────────────────────────────────────────────
    await supabase
      .from('profiles')
      .update({
        last_pattern_analysis_at:       new Date().toISOString(),
        pattern_analysis_session_count: totalSessions,
      })
      .eq('user_id', user_id);

    console.log(`[analyze-patterns] user=${user_id} sessions=${totalSessions} distinct=${distinctSessions} saved=${saved}`);
    return ok({ patterns_saved: saved, sessions_analyzed: distinctSessions });

  } catch (err: any) {
    console.error(`[analyze-patterns] user=${user_id} error:`, err?.message ?? err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function ok(body: object) {
  return new Response(
    JSON.stringify(body),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
