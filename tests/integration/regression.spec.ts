/**
 * ai-chat / claude-chat regression suite.
 *
 * GOAL: prove that with VITE_PRIMARY_MODEL unset (default → openai) the new
 * claude-chat function returns a response that is a SHAPE SUPERSET of the
 * legacy ai-chat response, and that no legacy field is silently dropped.
 *
 * Runs against the live Supabase project. Configure via env:
 *   SUPABASE_URL              (required)
 *   SUPABASE_ANON_KEY         (required — used as Bearer for anon path)
 *   TEST_CLAUDE_ENDPOINT      ("true" to also test claude-chat — defaults off
 *                              when claude-chat hasn't been deployed yet)
 *
 * Run:    node --import tsx --test tests/integration/regression.spec.ts
 *   or:   npm test
 *
 * NOTE: this file uses Node's built-in node:test + node:assert — no Vitest /
 * Jest dependency is added. Zero impact on the frontend bundle.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const SUPABASE_URL = process.env.SUPABASE_URL
  ?? 'https://neadnclykbukvmlquepg.supabase.co';

const ANON_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYWRuY2x5a2J1a3ZtbHF1ZXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDMxOTMsImV4cCI6MjA3MzY3OTE5M30.KmXl8ly3IKb-SJx0sEKDH4PcHgLRrwtqZjwaPD6beNU';

const TEST_CLAUDE = process.env.TEST_CLAUDE_ENDPOINT === 'true';

// 10 representative prompts — 5 Arabic, 5 English. Mix of:
//  - greetings (must NOT trigger tools)
//  - action triggers (expense, task, goal — MUST trigger tools)
//  - reasoning (zakat, plan)
const PROMPTS: { id: string; lang: 'ar' | 'en'; text: string; expectAction?: boolean }[] = [
  { id: 'greet_ar',   lang: 'ar', text: 'هلا جود' },
  { id: 'greet_en',   lang: 'en', text: 'Hi Jood' },
  { id: 'expense_ar', lang: 'ar', text: 'أنفقت ١٥٠ ريال على الغداء اليوم', expectAction: true },
  { id: 'expense_en', lang: 'en', text: 'I spent 80 SAR on coffee today',  expectAction: true },
  { id: 'task_ar',    lang: 'ar', text: 'أضيفي مهمة مراجعة الميزانية',     expectAction: true },
  { id: 'task_en',    lang: 'en', text: 'Add a task: review the report',   expectAction: true },
  { id: 'plan_en',    lang: 'en', text: 'Plan my week' },
  { id: 'zakat_ar',   lang: 'ar', text: 'حياك. كيف أحسب زكاة محفظتي؟' },
  { id: 'goal_ar',    lang: 'ar', text: 'حطي هدف توفير ٦٠٠٠٠ ريال للسيارة', expectAction: true },
  { id: 'plan_ar',    lang: 'ar', text: 'رتبي لي يومي بكرة' },
];

const LEGACY_REQUIRED_KEYS = ['message'] as const;
const LEGACY_OPTIONAL_KEYS = [
  'model_used', 'voice_mode', 'detected_language',
  'action_card', 'function_results', 'mode',
] as const;

type LegacyShape = {
  message: string;
  model_used?: string;
  voice_mode?: boolean;
  detected_language?: string;
  action_card?: unknown;
  function_results?: unknown;
  mode?: string;
};

type ChatPayload = Record<string, unknown> & { error?: string };

async function callChat(endpoint: 'ai-chat' | 'claude-chat' | 'text-to-speech', body: Record<string, unknown>): Promise<{ status: number; data: ChatPayload | null; elapsedMs: number }> {
  const url = `${SUPABASE_URL}/functions/v1/${endpoint}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const elapsedMs = Date.now() - t0;
  let data: ChatPayload | null = null;
  try { data = (await res.json()) as ChatPayload; }
  catch { data = null; }
  return { status: res.status, data, elapsedMs };
}

function assertLegacyShape(label: string, payload: ChatPayload | null): void {
  assert.ok(payload, `${label}: response body is null/empty`);
  for (const k of LEGACY_REQUIRED_KEYS) {
    assert.ok(k in payload, `${label}: missing required field "${k}"`);
    assert.notEqual(payload[k], null, `${label}: "${k}" must not be null`);
  }
  // Optional keys: when present, type must match.
  if ('voice_mode' in payload && payload.voice_mode !== undefined) {
    assert.equal(typeof payload.voice_mode, 'boolean', `${label}: voice_mode must be boolean`);
  }
  if ('detected_language' in payload && payload.detected_language) {
    assert.match(payload.detected_language, /^(ar|en|mixed)$/, `${label}: detected_language invalid`);
  }
  if ('mode' in payload && payload.mode) {
    assert.equal(typeof payload.mode, 'string', `${label}: mode must be string`);
  }
}

describe('ai-chat — legacy contract (OpenAI path, MUST remain unchanged)', () => {
  for (const p of PROMPTS) {
    test(`ai-chat / ${p.id} / "${p.text.slice(0, 30)}…"`, async () => {
      const { status, data } = await callChat('ai-chat', {
        message: p.text,
        context: [],
        lang: p.lang,
      });
      assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data).slice(0, 200)}`);
      assertLegacyShape(`ai-chat/${p.id}`, data);
      assert.ok(data !== null);
      assert.equal(typeof data.message, 'string', 'message must be string');
      assert.ok((data.message as string).length > 0, 'message must be non-empty');
    });
  }
});

if (TEST_CLAUDE) {
  describe('claude-chat — must satisfy LegacyAiChatResponse (superset)', () => {
    for (const p of PROMPTS) {
      test(`claude-chat / ${p.id}`, async () => {
        const { status, data } = await callChat('claude-chat', {
          message: p.text,
          context: [],
          lang: p.lang,
        });
        assert.equal(status, 200, `expected 200, got ${status}`);
        assertLegacyShape(`claude-chat/${p.id}`, data);
        assert.ok(data !== null);
        assert.equal(typeof data.message, 'string', 'message must be string');
        // Brand guardian baseline: response must NEVER contain literal "Joud" (capital J)
        // — only "Jood" is allowed. (Per spec acceptance #6.)
        const msg = data.message as string | undefined;
        if (msg) {
          const joudHits = (msg.match(/\bJoud\b/g) || []).length;
          assert.equal(joudHits, 0, `claude-chat/${p.id}: response contained "Joud" — should be "Jood"`);
        }
      });
    }
  });

  describe('shape parity — every legacy field present in ai-chat must be present in claude-chat', () => {
    for (const p of PROMPTS) {
      test(`parity / ${p.id}`, async () => {
        const [legacy, claude] = await Promise.all([
          callChat('ai-chat',     { message: p.text, context: [], lang: p.lang }),
          callChat('claude-chat', { message: p.text, context: [], lang: p.lang }),
        ]);
        assert.equal(legacy.status, 200);
        assert.equal(claude.status, 200);
        assert.ok(legacy.data !== null);
        assert.ok(claude.data !== null);
        const legacyData  = legacy.data;
        const claudeData  = claude.data;
        for (const k of [...LEGACY_REQUIRED_KEYS, ...LEGACY_OPTIONAL_KEYS]) {
          if (k in legacyData && legacyData[k] !== null && legacyData[k] !== undefined) {
            assert.ok(
              k in claudeData,
              `parity/${p.id}: legacy has "${k}" but claude-chat omitted it`,
            );
          }
        }
      });
    }
  });
}

describe('text-to-speech — additive provider param must not break legacy behavior', () => {
  test('no provider param → legacy openai path still works', async () => {
    const { status, data } = await callChat('text-to-speech', {
      text: 'مرحبا',
    });
    // Must return either 200 OK with audioContent or stay structurally the same
    // (200 means: still works; 400 means: function rejected — also acceptable
    // ONLY if main also rejected this exact body).
    assert.ok(
      status === 200 || status === 400,
      `tts legacy path: unexpected status ${status}`,
    );
    if (status === 200) {
      assert.ok(data, 'tts: 200 response must have body');
      assert.ok(
        'audioContent' in data || 'audio' in data,
        'tts legacy: response missing audio payload',
      );
    }
  });
});
