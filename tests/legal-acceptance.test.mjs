import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGAL_ACCEPTANCE_KEY,
  buildLegalAcceptance,
  pendingAgreementRows,
  readLegalAcceptance,
} from '../src/lib/legalAcceptance.ts';

const acceptedAt = new Date('2026-10-30T12:00:00.000Z');

test('sign-up acceptance round-trips through user metadata', () => {
  const acceptance = buildLegalAcceptance({ terms: '1.0', privacy: '1.0' }, acceptedAt, 'TestAgent/1.0');
  const metadata = { display_name: 'Joud', [LEGAL_ACCEPTANCE_KEY]: acceptance };
  assert.deepEqual(readLegalAcceptance(metadata), {
    terms_version: '1.0',
    privacy_version: '1.0',
    accepted_at: '2026-10-30T12:00:00.000Z',
    user_agent: 'TestAgent/1.0',
  });
});

test('metadata without a valid acceptance yields nothing', () => {
  assert.equal(readLegalAcceptance(undefined), null);
  assert.equal(readLegalAcceptance({ display_name: 'Joud' }), null);
  assert.equal(readLegalAcceptance({ [LEGAL_ACCEPTANCE_KEY]: 'yes' }), null);
  assert.equal(readLegalAcceptance({ [LEGAL_ACCEPTANCE_KEY]: { terms_version: '1.0' } }), null);
  assert.equal(readLegalAcceptance({ [LEGAL_ACCEPTANCE_KEY]: { terms_version: '1.0', accepted_at: 'soon' } }), null);
});

test('a new user gets one row per accepted agreement, stamped with the sign-up time', () => {
  const acceptance = buildLegalAcceptance({ terms: '1.0', privacy: '1.0' }, acceptedAt, 'TestAgent/1.0');
  assert.deepEqual(pendingAgreementRows('user-1', acceptance, []), [
    { user_id: 'user-1', agreement_type: 'terms', version: '1.0', accepted_at: '2026-10-30T12:00:00.000Z', user_agent: 'TestAgent/1.0' },
    { user_id: 'user-1', agreement_type: 'privacy', version: '1.0', accepted_at: '2026-10-30T12:00:00.000Z', user_agent: 'TestAgent/1.0' },
  ]);
});

test('rows already recorded are not inserted again', () => {
  const acceptance = buildLegalAcceptance({ terms: '1.0', privacy: '1.0' }, acceptedAt);
  const partial = pendingAgreementRows('user-1', acceptance, [{ agreement_type: 'terms', version: '1.0' }]);
  assert.deepEqual(partial.map(r => r.agreement_type), ['privacy']);
  assert.equal(partial[0].user_agent, null);
  const done = pendingAgreementRows('user-1', acceptance, [
    { agreement_type: 'terms', version: '1.0' },
    { agreement_type: 'privacy', version: '1.0' },
  ]);
  assert.deepEqual(done, []);
});

test('an older accepted version does not count as the signed-up version', () => {
  const acceptance = buildLegalAcceptance({ terms: '2.0' }, acceptedAt);
  const rows = pendingAgreementRows('user-1', acceptance, [{ agreement_type: 'terms', version: '1.0' }]);
  assert.deepEqual(rows.map(r => [r.agreement_type, r.version]), [['terms', '2.0']]);
});
