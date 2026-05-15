/**
 * supabase/functions/_shared/skills/loader.ts
 *
 * Loads SKILL.md files from disk and concatenates the active ones into the
 * system prompt. Only used by claude-chat. Inert when ENABLE_SKILLS is false.
 */

const SKILL_IDS = [
  'jood-brand-guardian',
  'zakat-engine',
  'prayer-aware-planner',
  'saudi-finance-insight',
  'majlis-conversation',
] as const;
export type SkillId = typeof SKILL_IDS[number];

/** Read a SKILL.md from disk. Cached per-instance. */
const cache = new Map<SkillId, string>();

async function readSkill(id: SkillId): Promise<string> {
  if (cache.has(id)) return cache.get(id)!;
  // Deno edge runtime resolves relative paths against the function root.
  // The shared skills folder is mounted as ../_shared/skills/<id>/SKILL.md.
  const url = new URL(`./${id}/SKILL.md`, import.meta.url);
  try {
    const text = await Deno.readTextFile(url);
    cache.set(id, text);
    return text;
  } catch (_err) {
    // If the file isn't bundled (different mount), fall back to empty —
    // the system prompt is still usable without it.
    cache.set(id, '');
    return '';
  }
}

/**
 * Pick the subset of skills that should activate for this turn.
 * - jood-brand-guardian: always on
 * - majlis-conversation: on when voice_mode
 * - zakat-engine, prayer-aware-planner, saudi-finance-insight: keyword-gated
 */
export function selectSkills(message: string, voice_mode: boolean): SkillId[] {
  const lower = message.toLowerCase();
  const active: SkillId[] = ['jood-brand-guardian'];
  if (voice_mode) active.push('majlis-conversation');

  if (/zakat|zakah|زكاة|nisab|niṣāb|hawl|حول|نصاب/i.test(message)) active.push('zakat-engine');
  if (/prayer|fajr|dhuhr|asr|maghrib|isha|صلاة|الفجر|الظهر|العصر|المغرب|العشاء|plan my (day|week)|رتب(ي)? لي|اجدول/i.test(message)) active.push('prayer-aware-planner');
  if (/tadawul|tasi|sukuk|sama|aramco|rajhi|halal|riba|2222|1120|ريت|مرابحة|تداول|صكوك/i.test(message)) active.push('saudi-finance-insight');

  return active;
}

/** Build the skill section of the system prompt. */
export async function buildSkillSection(ids: SkillId[]): Promise<string> {
  const parts = await Promise.all(ids.map(readSkill));
  return parts
    .filter(Boolean)
    .map(t => `\n\n--- SKILL ---\n${t}\n--- END SKILL ---`)
    .join('');
}
