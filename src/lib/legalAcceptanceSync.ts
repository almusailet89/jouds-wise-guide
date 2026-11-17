import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { pendingAgreementRows, readLegalAcceptance } from './legalAcceptance';

// One attempt per user per page load; a failed attempt retries on the next load.
const synced = new Set<string>();

// Writes the user_agreements rows for the acceptance captured at sign-up, if any are missing.
export const syncLegalAcceptance = async (user: User): Promise<void> => {
  if (synced.has(user.id)) return;
  const acceptance = readLegalAcceptance(user.user_metadata);
  if (!acceptance) return;
  synced.add(user.id);

  try {
    const { data: existing, error: selectError } = await supabase
      .from('user_agreements')
      .select('agreement_type, version')
      .eq('user_id', user.id);
    if (selectError) throw selectError;

    const rows = pendingAgreementRows(user.id, acceptance, existing ?? []);
    if (rows.length === 0) return;

    const { error: insertError } = await supabase.from('user_agreements').insert(rows);
    if (insertError) throw insertError;
  } catch (error) {
    synced.delete(user.id);
    console.error('Error recording legal agreement acceptance:', error);
  }
};
