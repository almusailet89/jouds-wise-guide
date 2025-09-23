import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function parseTimeframe(tf?: string): { start?: string; end?: string; label: string } {
  const now = new Date();
  if (!tf) return { label: 'all_time' };
  const s = tf.toLowerCase().trim().replace(/\s+/g, ' ');

  // Helpers
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay(); // 0=Sun
    x.setDate(x.getDate() - day);
    x.setHours(0,0,0,0);
    return x;
  };
  const endOfWeek = (d: Date) => {
    const sow = startOfWeek(d);
    const e = new Date(sow);
    e.setDate(sow.getDate() + 6);
    e.setHours(23,59,59,999);
    return e;
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
  const startOfQuarter = (d: Date) => {
    const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), qStartMonth, 1, 0,0,0,0);
  };
  const endOfQuarter = (d: Date) => {
    const qStart = startOfQuarter(d);
    return new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0, 23,59,59,999);
  };

  // Basic keywords
  if (s === 'today') {
    return { start: startOfDay(now).toISOString(), end: now.toISOString(), label: 'today' };
  }
  if (s === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: startOfDay(y).toISOString(), end: endOfDay(y).toISOString(), label: 'yesterday' };
  }
  if (s === 'this week' || s === 'this_week' || s === 'week to date' || s === 'wtd') {
    return { start: startOfWeek(now).toISOString(), end: now.toISOString(), label: 'this_week' };
  }
  if (s === 'last week' || s === 'last_week') {
    // previous calendar week
    const sow = startOfWeek(now);
    const prevWeekEnd = new Date(sow.getTime() - 1);
    const prevWeekStart = startOfWeek(new Date(prevWeekEnd));
    return { start: prevWeekStart.toISOString(), end: prevWeekEnd.toISOString(), label: 'last_week' };
  }
  if (s === 'this month' || s === 'this_month' || s === 'month to date' || s === 'mtd') {
    return { start: startOfMonth(now).toISOString(), end: now.toISOString(), label: 'this_month' };
  }
  if (s === 'last month' || s === 'last_month') {
    const firstOfThisMonth = startOfMonth(now);
    const end = new Date(firstOfThisMonth.getTime() - 1);
    const start = startOfMonth(new Date(end));
    return { start: start.toISOString(), end: end.toISOString(), label: 'last_month' };
  }
  if (s === 'this quarter' || s === 'this_quarter' || s === 'qtd' || s === 'quarter to date') {
    return { start: startOfQuarter(now).toISOString(), end: now.toISOString(), label: 'this_quarter' };
  }
  if (s === 'last quarter' || s === 'last_quarter') {
    const thisQStart = startOfQuarter(now);
    const prevQEnd = new Date(thisQStart.getTime() - 1);
    const prevQStart = startOfQuarter(new Date(prevQEnd));
    return { start: prevQStart.toISOString(), end: prevQEnd.toISOString(), label: 'last_quarter' };
  }
  if (s === 'this year' || s === 'this_year' || s === 'ytd' || s === 'year to date') {
    const start = new Date(now.getFullYear(), 0, 1, 0,0,0,0);
    return { start: start.toISOString(), end: now.toISOString(), label: 'this_year' };
  }
  if (s === 'last year' || s === 'last_year') {
    const start = new Date(now.getFullYear() - 1, 0, 1, 0,0,0,0);
    const end = new Date(now.getFullYear() - 1, 11, 31, 23,59,59,999);
    return { start: start.toISOString(), end: end.toISOString(), label: 'last_year' };
  }

  // Quarter like Q1/2025 or Q1-2025
  const qMatch = s.match(/q([1-4])[\/\-](\d{4})/i);
  if (qMatch) {
    const q = Number(qMatch[1]);
    const year = Number(qMatch[2]);
    const monthStart = (q - 1) * 3; // 0,3,6,9
    const start = new Date(year, monthStart, 1);
    const end = new Date(year, monthStart + 3, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), label: `Q${q}/${year}` };
  }

  // Rolling windows: past/last N units
  const lastNMatch = s.match(/(last|past)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/);
  if (lastNMatch) {
    const n = Number(lastNMatch[2]);
    const unit = lastNMatch[3];
    const start = new Date(now);
    if (unit.startsWith('day')) start.setDate(now.getDate() - n);
    else if (unit.startsWith('week')) start.setDate(now.getDate() - n * 7);
    else if (unit.startsWith('month')) start.setMonth(now.getMonth() - n);
    else if (unit.startsWith('year')) start.setFullYear(now.getFullYear() - n);
    return { start: start.toISOString(), end: now.toISOString(), label: `${lastNMatch[1]}_${n}_${unit}` };
  }

  return { label: 'all_time' };
}

function formatCurrency(amount: number, currency = 'SAR') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch { return `${currency} ${amount.toFixed(2)}`; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, message: 'Only POST supported' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { timeframe, target, categories, tags, question } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;

    const range = parseTimeframe(timeframe);

    async function queryFinance() {
      let q = supabaseAdmin
        .from('financial_entries')
        .select('type, amount, currency, category, occurred_at')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false });
      if (range.start) q = q.gte('occurred_at', range.start);
      if (range.end) q = q.lte('occurred_at', range.end);
      if (Array.isArray(categories) && categories.length > 0) q = q.in('category', categories);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [] as Array<{ type: string; amount: number; currency: string; category: string | null; occurred_at: string }>;
      let income = 0, expenses = 0;
      const byCategory: Record<string, number> = {};
      const currency = rows[0]?.currency || 'SAR';
      for (const r of rows) {
        const amt = Number(r.amount) || 0;
        if (String(r.type).toLowerCase() === 'income') income += amt; else if (String(r.type).toLowerCase() === 'expense') expenses += amt;
        const cat = r.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      }
      const topCats = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 5);
      const summaryText = `From ${range.start ? new Date(range.start).toLocaleDateString() : 'beginning'} to ${range.end ? new Date(range.end).toLocaleDateString() : 'now'}, you spent ${formatCurrency(expenses, currency)} and earned ${formatCurrency(income, currency)}. Top categories: ${topCats.map(([k,v]) => `${k} ${formatCurrency(v, currency)}`).join(', ') || 'n/a'}.`;
      return { income, expenses, by_category: byCategory, currency, count: rows.length, summary_text: summaryText };
    }

    async function queryMood() {
      let q = supabaseAdmin
        .from('mood_logs')
        .select('mood_score, mood_label, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (range.start) q = q.gte('created_at', range.start);
      if (range.end) q = q.lte('created_at', range.end);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [] as Array<{ mood_score: number; mood_label: string | null; created_at: string }>;
      let sum = 0; const counts: Record<string, number> = {}; let n = 0;
      for (const r of rows) { const s = Number(r.mood_score) || 0; sum += s; n++; const lbl = r.mood_label || 'neutral'; counts[lbl] = (counts[lbl] || 0) + 1; }
      const avg = n > 0 ? sum / n : 0;
      const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || 'n/a';
      const summaryText = `From ${range.start ? new Date(range.start).toLocaleDateString() : 'beginning'} to ${range.end ? new Date(range.end).toLocaleDateString() : 'now'}, average mood score was ${avg.toFixed(1)}. Most frequent mood: ${top}. Total entries: ${n}.`;
      return { average_score: avg, counts, total: n, summary_text: summaryText };
    }

    async function queryTasks() {
      let q = supabaseAdmin
        .from('tasks')
        .select('id, title, status, due_date, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (range.start) q = q.gte('created_at', range.start);
      if (range.end) q = q.lte('created_at', range.end);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [] as Array<{ id: string; title: string; status: string; due_date: string | null; created_at: string }>;
      const counts: Record<string, number> = {};
      for (const r of rows) { const s = r.status || 'pending'; counts[s] = (counts[s] || 0) + 1; }
      const summaryText = `Task summary ${range.start ? `from ${new Date(range.start).toLocaleDateString()}` : ''}${range.end ? ` to ${new Date(range.end).toLocaleDateString()}` : ''}: ${rows.length} tasks — ${Object.entries(counts).map(([k,v]) => `${k}: ${v}`).join(', ') || 'no tasks'}.`;
      return { total: rows.length, counts, sample: rows.slice(0,5), summary_text: summaryText };
    }

    async function queryGoals() {
      // Flexible query: handle missing table gracefully
      try {
        let q = supabaseAdmin
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (range.start) q = q.gte('created_at', range.start);
        if (range.end) q = q.lte('created_at', range.end);
        const { data, error } = await q;
        if (error) throw error;
        const rows = data || [] as any[];
        const summaryText = `Goals ${range.start ? `from ${new Date(range.start).toLocaleDateString()}` : ''}${range.end ? ` to ${new Date(range.end).toLocaleDateString()}` : ''}: ${rows.length} goals tracked.`;
        return { total: rows.length, sample: rows.slice(0,5), summary_text: summaryText };
      } catch (_e) {
        return { total: 0, sample: [], summary_text: 'No goals data available.' };
      }
    }

    async function queryKnowledge() {
      try {
        let q = supabaseAdmin
          .from('knowledge_vault')
          .select('id, title, tags, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (range.start) q = q.gte('created_at', range.start);
        if (range.end) q = q.lte('created_at', range.end);
        if (Array.isArray(tags) && tags.length > 0) q = q.contains('tags', tags);
        const { data, error } = await q;
        if (error) throw error;
        const rows = data || [] as Array<{ id: string; title: string; tags: string[] | null; created_at: string }>;
        const tagCounts: Record<string, number> = {};
        for (const r of rows) { for (const t of (r.tags || [])) { tagCounts[t] = (tagCounts[t] || 0) + 1; } }
        const top = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
        const summaryText = `Knowledge items ${range.start ? `from ${new Date(range.start).toLocaleDateString()}` : ''}${range.end ? ` to ${new Date(range.end).toLocaleDateString()}` : ''}: ${rows.length} items. Top tags: ${top.map(([k,v]) => `${k} (${v})`).join(', ') || 'n/a'}.`;
        return { total: rows.length, tag_counts: tagCounts, sample: rows.slice(0,5), summary_text: summaryText };
      } catch (_e) {
        return { total: 0, tag_counts: {}, sample: [], summary_text: 'No knowledge data available.' };
      }
    }

    let payload: any = {};
    const t = String(target || '').toLowerCase();
    if (t === 'mood') payload = await queryMood();
    else if (t === 'tasks') payload = await queryTasks();
    else if (t === 'goals') payload = await queryGoals();
    else if (t === 'knowledge' || t === 'categories') payload = await queryKnowledge();
    else payload = await queryFinance();

    return new Response(JSON.stringify({ ok: true, target: t || 'finance', timeframe: range.label, range, ...payload }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('memory-query error:', error);
    return new Response(JSON.stringify({ ok: false, message: (error as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
