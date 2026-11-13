import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification } from '../src/company-os/generated/feature_d75b7972df85.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFERRED = '22222222-2222-4222-8222-222222222222';
const CREATED = '2025-01-01T00:00:00.000Z';

function action(kind, at) {
  return { kind, at };
}

test('qualifies when referred member performs two distinct actions in window', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    referralCreatedAt: CREATED,
    actions: [
      action('check_in', '2025-01-02T00:00:00.000Z'),
      action('puzzle_complete', '2025-01-03T00:00:00.000Z'),
    ],
  });
  assert.equal(result.qualified, true);
  assert.equal(result.reason, 'QUALIFIED');
  assert.equal(result.qualifyingActions, 2);
  assert.equal(result.firstQualifyingAt, '2025-01-02T00:00:00.000Z');
});

test('rejects self-referral and invalid ids', () => {
  const self = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRER,
    referralCreatedAt: CREATED,
    actions: [action('check_in', '2025-01-02T00:00:00.000Z')],
  });
  assert.equal(self.qualified, false);
  assert.equal(self.reason, 'SELF_REFERRAL');

  const bad = evaluateReferralQualification({
    referrerId: 'not-a-uuid',
    referredId: REFERRED,
    referralCreatedAt: CREATED,
    actions: [],
  });
  assert.equal(bad.qualified, false);
  assert.equal(bad.reason, 'INVALID_IDS');
});

test('does not qualify on duplicate actions or actions outside the window', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    referralCreatedAt: CREATED,
    windowDays: 7,
    actions: [
      action('check_in', '2025-01-02T00:00:00.000Z'),
      action('check_in', '2025-01-03T00:00:00.000Z'),
      action('puzzle_complete', '2025-02-01T00:00:00.000Z'),
    ],
  });
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_ACTIVITY');
  assert.equal(result.qualifyingActions, 1);
  assert.equal(result.windowEndsAt, '2025-01-08T00:00:00.000Z');
});
