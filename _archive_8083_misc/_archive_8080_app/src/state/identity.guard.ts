export function assertIdentity(answer: string): boolean {
  if (!answer || typeof answer !== 'string') return false;
  const s = answer.toLowerCase();
  const mentionsName = s.includes("i'm jood") || s.includes('i am jood') || s.includes('my name is jood');
  const mentionsRole = s.includes('financial') || s.includes('co-pilot') || s.includes('assistant');
  return mentionsName && mentionsRole;
}
