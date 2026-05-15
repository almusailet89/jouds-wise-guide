/**
 * supabase/functions/_shared/tools.ts
 *
 * Anthropic tool-use definitions for the new claude-chat edge function.
 *
 * Each tool exposes a Claude-shaped input schema and an `execute()` that
 * proxies to one of the EXISTING Supabase edge functions via fetch. No
 * existing function is modified; this file is the adapter layer.
 *
 * IMPORTANT: this file is loaded by claude-chat ONLY. The legacy ai-chat
 * function does not import it. If you change a tool here, the OpenAI path
 * is unaffected — the regression suite must continue to pass.
 */

// ─── Anthropic tool definition shape ─────────────────────────────────────────
export interface AnthropicTool {
  name:         string;
  description:  string;
  input_schema: {
    type:       'object';
    properties: Record<string, unknown>;
    required?:  string[];
  };
}

// ─── Project-ref derivation helper ───────────────────────────────────────────
function functionsBaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  const ref = match ? match[1] : '';
  return ref ? `https://${ref}.functions.supabase.co` : '';
}

// ─── Tool execution dispatcher ───────────────────────────────────────────────
export async function executeTool(
  name:       string,
  input:      Record<string, unknown>,
  authHeader: string,
): Promise<unknown> {
  const base = functionsBaseUrl();
  if (!base) throw new Error('SUPABASE_URL not configured');

  switch (name) {
    case 'get_prayer_times':
      return await fetchPrayerTimes(input);

    case 'calculate_zakat':
      return await calculateZakat(input);

    case 'get_hijri_date':
      return await getHijriDate(input);

    case 'get_portfolio_snapshot':
      // Routes through the existing portfolio-actions edge function (GET equivalent).
      return await proxy(base, 'manage-portfolio', authHeader, { action: 'snapshot', ...input });

    case 'schedule_task':
      // Routes through the existing tasks-actions edge function.
      return await proxy(base, 'tasks-actions', authHeader, { action: 'create', ...input });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Pure tools (no edge function dependency) ────────────────────────────────

async function fetchPrayerTimes(input: Record<string, unknown>): Promise<unknown> {
  const city    = (input.city    as string) ?? 'Riyadh';
  const country = (input.country as string) ?? 'SA';
  const method  = (input.method  as string) ?? '4'; // Umm al-Qura
  const res = await fetch(
    `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${country}&method=${method}`,
    { signal: AbortSignal.timeout(3000) },
  );
  if (!res.ok) throw new Error(`prayer times: HTTP ${res.status}`);
  const json = await res.json();
  return json?.data?.timings ?? null;
}

function calculateZakat(input: Record<string, unknown>): { zakat_due_sar: number; eligible_wealth_sar: number; nisab_sar: number; below_nisab: boolean } {
  const cash       = Number(input.cash_sar       ?? 0);
  const gold       = Number(input.gold_value_sar ?? 0);
  const investments= Number(input.investments_sar?? 0);
  const inventory  = Number(input.inventory_sar  ?? 0);
  const debts      = Number(input.debts_sar      ?? 0);
  const nisab      = Number(input.nisab_sar      ?? 20000); // ~85g gold in SAR; caller refreshes

  const wealth = cash + gold + investments + inventory - debts;
  if (wealth < nisab) {
    return { zakat_due_sar: 0, eligible_wealth_sar: wealth, nisab_sar: nisab, below_nisab: true };
  }
  // 2.5% rate
  const zakat = Math.round(wealth * 0.025 * 100) / 100;
  return { zakat_due_sar: zakat, eligible_wealth_sar: wealth, nisab_sar: nisab, below_nisab: false };
}

function getHijriDate(input: Record<string, unknown>): { hijri: string; gregorian: string } {
  const lang = (input.lang as string) ?? 'ar';
  const locale = lang === 'en' ? 'en-SA-u-ca-islamic' : 'ar-SA-u-ca-islamic';
  const now = new Date();
  const hijri = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(now);
  return { hijri, gregorian: now.toISOString().slice(0, 10) };
}

// ─── Edge-function proxy helper (additive — never modifies the target) ──────
async function proxy(
  base:       string,
  fnName:     string,
  authHeader: string,
  body:       Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${base}/${fnName}`, {
    method:  'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${fnName} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// ─── Tool catalog exported to claude-chat ────────────────────────────────────
export const TOOLS: AnthropicTool[] = [
  {
    name: 'get_prayer_times',
    description: "Get today's five daily prayer times for a city. Defaults to Riyadh / Umm al-Qura.",
    input_schema: {
      type: 'object',
      properties: {
        city:    { type: 'string', description: 'City name, e.g. Riyadh' },
        country: { type: 'string', description: 'ISO country, e.g. SA' },
        method:  { type: 'string', description: 'Calculation method ID (Aladhan)' },
      },
    },
  },
  {
    name: 'calculate_zakat',
    description: 'Compute zakat at 2.5% on eligible wealth above niṣāb. Caller supplies SAR amounts.',
    input_schema: {
      type: 'object',
      properties: {
        cash_sar:        { type: 'number' },
        gold_value_sar:  { type: 'number' },
        investments_sar: { type: 'number' },
        inventory_sar:   { type: 'number' },
        debts_sar:       { type: 'number', description: 'Outstanding debts to subtract' },
        nisab_sar:       { type: 'number', description: 'Niṣāb in SAR (≈85g gold). Caller should refresh annually.' },
      },
    },
  },
  {
    name: 'get_hijri_date',
    description: 'Get the current Hijri date in Arabic or English.',
    input_schema: {
      type: 'object',
      properties: {
        lang: { type: 'string', enum: ['ar', 'en'] },
      },
    },
  },
  {
    name: 'get_portfolio_snapshot',
    description: "Get a snapshot of the user's portfolio holdings (stocks, crypto, real estate, cash).",
    input_schema: {
      type: 'object',
      properties: {
        asset_type: { type: 'string', enum: ['stock', 'crypto', 'real_estate', 'all'] },
      },
    },
  },
  {
    name: 'schedule_task',
    description: 'Create a task in the user’s to-do list. Use when the user asks to remember something or schedule work.',
    input_schema: {
      type: 'object',
      properties: {
        title:    { type: 'string' },
        due_date: { type: 'string', description: 'ISO date' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        notes:    { type: 'string' },
      },
      required: ['title'],
    },
  },
];
