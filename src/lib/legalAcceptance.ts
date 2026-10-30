// Legal-agreement acceptance captured at sign-up.
//
// With email confirmation on, supabase.auth.signUp returns no session, and the
// user_agreements RLS policy only allows inserts where auth.uid() = user_id. So the
// acceptance is stored in the sign-up user metadata and turned into user_agreements
// rows on the user's first authenticated session (see AuthProvider).
//
// Kept free of imports so it can be unit-tested with plain `node --test`.

export type AgreementType = 'terms' | 'privacy';

export const LEGAL_ACCEPTANCE_KEY = 'legal_acceptance';

export interface LegalAcceptance {
  terms_version?: string;
  privacy_version?: string;
  accepted_at: string;
  user_agent?: string;
}

export interface AgreementRowInsert {
  user_id: string;
  agreement_type: AgreementType;
  version: string;
  accepted_at: string;
  user_agent: string | null;
}

export const buildLegalAcceptance = (
  versions: Partial<Record<AgreementType, string>>,
  acceptedAt: Date = new Date(),
  userAgent?: string,
): LegalAcceptance => ({
  terms_version: versions.terms,
  privacy_version: versions.privacy,
  accepted_at: acceptedAt.toISOString(),
  user_agent: userAgent?.slice(0, 512),
});

export const readLegalAcceptance = (metadata: unknown): LegalAcceptance | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>)[LEGAL_ACCEPTANCE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.accepted_at !== 'string' || Number.isNaN(Date.parse(value.accepted_at))) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  return {
    terms_version: str(value.terms_version),
    privacy_version: str(value.privacy_version),
    accepted_at: value.accepted_at,
    user_agent: str(value.user_agent),
  };
};

// Rows still missing for an acceptance, given the (type, version) pairs already stored.
export const pendingAgreementRows = (
  userId: string,
  acceptance: LegalAcceptance,
  existing: ReadonlyArray<{ agreement_type: string; version: string }>,
): AgreementRowInsert[] => {
  const have = new Set(existing.map(r => `${r.agreement_type}:${r.version}`));
  const wanted: Array<[AgreementType, string | undefined]> = [
    ['terms', acceptance.terms_version],
    ['privacy', acceptance.privacy_version],
  ];
  return wanted
    .filter((entry): entry is [AgreementType, string] => !!entry[1] && !have.has(`${entry[0]}:${entry[1]}`))
    .map(([type, version]) => ({
      user_id: userId,
      agreement_type: type,
      version,
      accepted_at: acceptance.accepted_at,
      user_agent: acceptance.user_agent ?? null,
    }));
};
