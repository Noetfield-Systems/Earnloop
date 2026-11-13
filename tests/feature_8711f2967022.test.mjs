import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification, REFERRAL_POLICY } from '../src/company-os/generated/feature_8711f2967022.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFERRED = '22222222-2222-4222-8222-222222222222';
const DAY = 86400000;
const T0 = Date.UTC(2025, 0, 1, 12, 0, 0);

function act(type, offsetMs) {
  return { type, at: new Date(T0 + offsetMs).toISOString() };
}

test('qualifies when actions span distinct days within window', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    actions: [
      act('checkin', 0),
      act('puzzle_complete', 1000),
      act('checkin', DAY)
    ]
  });
  assert.equal(result.qualified, true);
  assert.equal(result.reason, 'QUALIFIED');
  assert.equal(result.qualifyingActions, 3);
  assert.equal(result.distinctDays, 2);
});

test('rejects self-referral and invalid identity', () => {
  const self = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRER.toUpperCase(),
    actions: [act('checkin', 0), act('checkin', DAY), act('checkin', 2 * DAY)]
  });
  assert.equal(self.qualified, false);
  assert.equal(self.reason, 'SELF_REFERRAL');

  const bad = evaluateReferralQualification({
    referrerId: 'not-a-uuid',
    referredId: REFERRED,
    actions: [act('checkin', 0)]
  });
  assert.equal(bad.qualified, false);
  assert.equal(bad.reason, 'INVALID_IDENTITY');
});

test('fails when all activity is on a single day (edge case)', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    actions: [act('checkin', 0), act('puzzle_complete', 5000), act('checkin', 10000)]
  });
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_DISTINCT_DAYS');
  assert.equal(result.qualifyingActions, 3);
  assert.equal(result.distinctDays, 1);
});

test('ignores malformed actions and enforces window boundary', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    actions: [
      { type: 'checkin', at: 'not-a-date' },
      { type: '', at: new Date(T0).toISOString() },
      null,
      act('checkin', 0),
      act('checkin', DAY),
      act('checkin', REFERRAL_POLICY.qualificationWindowDays * DAY + 1)
    ]
  });
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_ACTIONS');
  assert.equal(result.qualifyingActions, 2);
  assert.equal(result.distinctDays, 2);
});
