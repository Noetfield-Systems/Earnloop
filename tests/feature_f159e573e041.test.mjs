import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification } from '../src/company-os/generated/feature_f159e573e041.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFERRED = '22222222-2222-4222-8222-222222222222';
const SIGNUP = '2024-01-01T00:00:00.000Z';

function day(n) {
  return new Date(Date.parse(SIGNUP) + n * 86400000).toISOString();
}

test('qualifies when referred member is active on enough distinct days', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    signedUpAt: SIGNUP,
    activityDays: [day(0), day(1), day(2), day(2)]
  });
  assert.equal(result.qualified, true);
  assert.equal(result.reason, 'QUALIFIED');
  assert.equal(result.activeDays, 3);
});

test('rejects insufficient activity and ignores out-of-window days', () => {
  const result = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    signedUpAt: SIGNUP,
    activityDays: [day(0), day(1), day(30)]
  });
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_ACTIVITY');
  assert.equal(result.activeDays, 2);
});

test('rejects self-referral and already-rewarded referrals', () => {
  const self = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRER.toUpperCase(),
    signedUpAt: SIGNUP,
    activityDays: [day(0), day(1), day(2)]
  });
  assert.equal(self.qualified, false);
  assert.equal(self.reason, 'SELF_REFERRAL');

  const rewarded = evaluateReferralQualification({
    referrerId: REFERRER,
    referredId: REFERRED,
    signedUpAt: SIGNUP,
    activityDays: [day(0), day(1), day(2)],
    alreadyRewarded: true
  });
  assert.equal(rewarded.qualified, false);
  assert.equal(rewarded.reason, 'ALREADY_REWARDED');
});
