/**
 * supabase/functions/claude-chat/index.ts
 *
 * Claude-powered chat endpoint. Strict superset of ai-chat:
 *   - Accepts the same request body (with optional `stream`, `model_tier`,
 *     `enable_skills` added).
 *   - Returns a body that satisfies `LegacyAiChatResponse` (see
 *     src/services/types.ts) plus optional `model`, `skill_id`, `tokens_used`,
 *     `streamed` fields.
 *
 * This file MUST NOT be imported by ai-chat. Only the new aiRouter dispatches
 * here, and only when VITE_PRIMARY_MODEL=claude on the client.
 *
 * Per Prime Directive: with the flag unset, this function is never called and
 * is effectively dead weight at runtime. It does not modify legacy behavior.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { TOOLS, executeTool } from '../_shared/tools.ts';
import { selectSkills, buildSkillSection } from '../_shared/skills/loader.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Model IDs (env-overridable single source of truth) ──────────────────────
const MODELS = {
  haiku:  Deno.env.get('CLAUDE_MODEL_HAIKU')  ?? 'claude-haiku-4-5',
  sonnet: Deno.env.get('CLAUDE_MODEL_SONNET') ?? 'claude-sonnet-4-6',
  opus:   Deno.env.get('CLAUDE_MODEL_OPUS')   ?? 'claude-opus-4-6',
};

const ANTHROPIC_VERSION = '2023-06-01';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickModelTier(
  message: string,
  voice_mode: boolean,
  override?: 'haiku' | 'sonnet' | 'opus',
): 'haiku' | 'sonnet' | 'opus' {
  if (override) return override;
  if (voice_mode) return 'haiku'; // sub-15-word replies → fastest tier
  // Opus only for genuinely multi-step financial planning / zakat across portfolio
  if (/zakat across|plan (my|the) (week|month|quarter)|portfolio.*(plan|forecast|rebalance|strategy)|deep.{0,20}analysis/i.test(message)) {
    return 'opus';
  }
  return 'sonnet';
}

function detectLanguage(message: string, hint?: string): 'ar' | 'en' {
  if (hint === 'ar' || hint === 'en') return hint;
  const arabic = (message.match(/[؀-ۿ]/g) || []).length;
  const latin  = (message.match(/[a-zA-Z]/g) || []).length;
  return arabic > latin ? 'ar' : 'en';
}

interface AnthropicMessage {
  role:    'user' | 'assistant';
  content: string | Array<
    | { type: 'text';       text: string }
    | { type: 'tool_use';   id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string }
  >;
}

interface AnthropicResponse {
  id:         string;
  model:      string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | string;
  content: Array<
    | { type: 'text';     text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  usage: { input_tokens: number; output_tokens: number };
}

async function callAnthropic(
  apiKey:  string,
  model:   string,
  system:  string,
  messages: AnthropicMessage[],
  opts: { max_tokens: number; tools?: typeof TOOLS; stream?: boolean },
): Promise<{ body: AnthropicResponse | null; status: number; raw?: string }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':           apiKey,
      'anthropic-version':   ANTHROPIC_VERSION,
      'content-type':        'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.max_tokens,
      system,
      messages,
      tools:  opts.tools,
      stream: opts.stream ?? false,
    }),
  });
  if (!res.ok) {
    const raw = await res.text();
    return { body: null, status: res.status, raw };
  }
  const body = await res.json() as AnthropicResponse;
  return { body, status: 200 };
}

// ─── Map Anthropic tool_use → action_card for legacy UI compatibility ────────
function toolUseToActionCard(
  name:  string,
  input: Record<string, unknown>,
): { kind: string; summary: string; data: Record<string, unknown> } | null {
  switch (name) {
    case 'schedule_task':
      return {
        kind:    'task',
        summary: String(input.title ?? 'New task'),
        data:    input,
      };
    case 'calculate_zakat':
      return {
        kind:    'finance',
        summary: 'Zakat calculation',
        data:    input,
      };
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      message,
      context           = [],
      mode,
      pendingFunction,
      voice_mode        = false,
      detected_language,
      lang              = 'ar',
      stream            = false,
      model_tier,
      enable_skills,
    } = body;

    if (!message) throw new Error('Message is required');

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const SKILLS_ENABLED = (enable_skills ?? Deno.env.get('ENABLE_SKILLS') === 'true');

    // ── Auth (optional but expected) ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    let userContext = '';
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          userId = userData.user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, base_currency, risk_profile')
            .eq('user_id', userId)
            .maybeSingle();
          if (profile) {
            userContext = `User: ${profile.display_name || 'User'} · currency: ${profile.base_currency} · risk: ${profile.risk_profile}`;
          }
        }
      } catch (_err) { /* anonymous fallback */ }
    }

    // ── Commit / cancel mode bypass (mirror ai-chat semantics) ────────────────
    // We don't execute DB writes here — claude-chat is the reasoning surface.
    // The legacy ai-chat function remains responsible for commits. If a client
    // somehow routes commit to claude-chat, we respond with a no-op envelope
    // that still satisfies LegacyAiChatResponse.
    if (mode === 'commit' || mode === 'cancel') {
      const lng = detectLanguage(message, detected_language);
      const msg = mode === 'commit'
        ? (lng === 'ar' ? 'تم.' : 'Done.')
        : (lng === 'ar' ? 'حسناً، لن أحفظ شيئاً.' : "Got it — nothing saved.");
      return new Response(JSON.stringify({
        message:           msg,
        mode,
        action_card:       null,
        function_results:  null,
        model_used:        MODELS.haiku,
        detected_language: lng,
        voice_mode,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Language + skills selection ───────────────────────────────────────────
    const lng = detectLanguage(message, detected_language);
    const activeSkills = SKILLS_ENABLED ? selectSkills(message, voice_mode) : [];
    const skillSection = SKILLS_ENABLED ? await buildSkillSection(activeSkills) : '';

    const langRule = lng === 'ar'
      ? 'LANGUAGE RULE: Reply ENTIRELY in Arabic, in a warm Najdi register. Technical symbols (BTC, SAR, %, ticker codes) may stay as-is.'
      : 'LANGUAGE RULE: Reply ENTIRELY in English.';

    const voiceRule = voice_mode
      ? 'VOICE RULE: Keep your reply under 15 words. No markdown, no bullets — plain speech only.'
      : '';

    const systemPrompt = [
      langRule,
      voiceRule,
      '',
      'You are Jood — a warm, sophisticated Saudi AI companion. You combine elite executive-assistant skills with deep financial expertise. Speak like a trusted friend, not a customer-service bot.',
      '',
      'PERSONALITY: warm, direct, encouraging. Short natural sentences. Ask one short follow-up when info is incomplete.',
      '',
      'CAPABILITIES: financial planning, expense tracking, investment portfolio, tasks, calendar, habits, goals, wellness, Islamic finance (zakat, halal).',
      '',
      'ACTION DETECTION: When the user mentions a recordable action — expense, income, task, event, goal — call the matching tool. The UI will show a preview card before saving.',
      '',
      userContext ? `Context: ${userContext}` : '',
      skillSection,
    ].filter(Boolean).join('\n');

    // ── Build messages array (Anthropic shape) ────────────────────────────────
    const anthMessages: AnthropicMessage[] = [
      ...(Array.isArray(context) ? context : []).map((m: { role: string; content: string }) => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      } as AnthropicMessage)),
      { role: 'user', content: message },
    ];

    // ── Pick model tier ───────────────────────────────────────────────────────
    const tier  = pickModelTier(message, voice_mode, model_tier);
    const model = MODELS[tier];
    const maxTokens = voice_mode ? 80 : tier === 'opus' ? 1200 : 800;

    // ── Streaming branch (advancement, gated by ?stream=true) ─────────────────
    if (stream) {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system:     systemPrompt,
          messages:   anthMessages,
          tools:      TOOLS,
          stream:     true,
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const txt = await upstream.text();
        throw new Error(`Anthropic stream error ${upstream.status}: ${txt.slice(0, 200)}`);
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'Connection':        'keep-alive',
          'X-JOOD-Model':      model,
          'X-JOOD-Skill-Ids':  activeSkills.join(','),
        },
      });
    }

    // ── Non-streaming branch (default — JSON response satisfying LegacyAiChatResponse) ─
    const first = await callAnthropic(ANTHROPIC_API_KEY, model, systemPrompt, anthMessages, {
      max_tokens: maxTokens,
      tools:      TOOLS,
    });

    if (!first.body) {
      throw new Error(`Anthropic error ${first.status}: ${(first.raw ?? '').slice(0, 200)}`);
    }

    let resp = first.body;
    let tokensIn  = resp.usage.input_tokens;
    let tokensOut = resp.usage.output_tokens;

    // Tool-use loop — Claude may chain up to N tool calls. Bound to 3 for safety.
    let iterations = 0;
    const MAX_ITER = 3;
    let executedActionCard: ReturnType<typeof toolUseToActionCard> = null;
    let executedFunctionResults: { preview_mode: boolean; function_call: { name: string; arguments: string } } | null = null;

    while (resp.stop_reason === 'tool_use' && iterations < MAX_ITER) {
      iterations++;
      // Find every tool_use block
      const toolUses = resp.content.filter((c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => c.type === 'tool_use');
      if (toolUses.length === 0) break;

      // For preview-mode actions, the FIRST recordable tool is shown as a card —
      // we do NOT execute it server-side. We still let Claude continue any
      // pure tools (get_prayer_times, get_hijri_date, calculate_zakat).
      const toolResults: AnthropicMessage = { role: 'user', content: [] };
      const contentArr = toolResults.content as Array<{ type: 'tool_result'; tool_use_id: string; content: string }>;

      for (const tu of toolUses) {
        if (tu.name === 'schedule_task' && !executedActionCard) {
          executedActionCard = toolUseToActionCard(tu.name, tu.input);
          executedFunctionResults = {
            preview_mode: true,
            function_call: { name: tu.name, arguments: JSON.stringify(tu.input) },
          };
          // Don't execute — return preview to the client.
          contentArr.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: 'Preview shown to user. Awaiting confirmation. Continue your reply.',
          });
        } else {
          // Pure read tools — execute server-side.
          try {
            const result = await executeTool(tu.name, tu.input, authHeader);
            contentArr.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            });
          } catch (err: unknown) {
            contentArr.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `Error: ${(err as Error).message}`,
            });
          }
        }
      }

      // Append assistant turn + user tool results and call again
      anthMessages.push({ role: 'assistant', content: resp.content });
      anthMessages.push(toolResults);

      const next = await callAnthropic(ANTHROPIC_API_KEY, model, systemPrompt, anthMessages, {
        max_tokens: maxTokens,
        tools:      TOOLS,
      });
      if (!next.body) break;
      resp       = next.body;
      tokensIn  += resp.usage.input_tokens;
      tokensOut += resp.usage.output_tokens;
    }

    // ── Extract final text ────────────────────────────────────────────────────
    const textBlocks = resp.content.filter((c): c is { type: 'text'; text: string } => c.type === 'text');
    const assistantMessage = textBlocks.map(b => b.text).join('\n').trim()
      || (lng === 'ar' ? 'مرحباً، أنا جود.' : "Hi, I'm Jood.");

    // ── Build LegacyAiChatResponse (+ optional extensions) ────────────────────
    return new Response(JSON.stringify({
      // ── Legacy fields (must match LegacyAiChatResponse contract) ──
      message:           assistantMessage,
      model_used:        model,
      voice_mode,
      detected_language: lng,
      action_card:       executedActionCard,
      function_results:  executedFunctionResults,
      mode:              executedFunctionResults?.preview_mode ? 'preview' : 'conversation',

      // ── Claude superset extensions (all optional) ─────────────────
      model,
      skill_id:    activeSkills[0] ?? undefined,
      tokens_used: { input: tokensIn, output: tokensOut },
      streamed:    false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = (error as Error).message || 'An error occurred';
    console.error('[claude-chat] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
