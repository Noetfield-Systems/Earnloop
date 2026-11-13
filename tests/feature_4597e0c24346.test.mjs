import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification } from '../src/company-os/generated/feature_4597e0c24346.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFERRED = '22222222-2222-4222-8222-222222222222';
const JOINED = '2024-01-01T00:00:00.000Z';
const CREATED = '2024-01-02T00:00:00.000Z';

function base(overrides = {}) {
  return {
    referrerId: REFERRER,
    referredId: REFERRED,
    referredJoinedAt: JOINED,
    referralCreatedAt: CREATED,
    activity: [
      { kind: 'checkin', at: '2024-01-03T00:00:00.000Z' },
      { kind: 'puzzle_complete', at: '2024-01-04T00:00:00.000Z' }
    ],
    ...overrides
  };
}

test('qualifies when referred member has two distinct in-window activities', () => {
  const result = evaluateReferralQualification(base());
  assert.equal(result.qualified, true);
  assert.equal(result.reason, 'QUALIFIED');
  assert.equal(result.distinctKinds, 2);
});

test('rejects self-referral even with strong activity', () => {
  const result = evaluateReferralQualification(base({ referredId: REFERRER }));
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'SELF_REFERRAL');
});

test('rejects when activity is outside the referral window', () => {
  const result = evaluateReferralQualification(base({
    activity: [
      { kind: 'checkin', at: '2024-03-01T00:00:00.000Z' },
      { kind: 'puzzle_complete', at: '2024-03-02T00:00:00.000Z' }
    ]
  }));
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_ACTIVITY');
  assert.equal(result.distinctKinds, 0);
});

test('rejects duplicate kinds and unknown kinds as insufficient distinct activity', () => {
  const result = evaluateReferralQualification(base({
    activity: [
      { kind: 'checkin', at: '2024-01-03T00:00:00.000Z' },
      { kind: 'checkin', at: '2024-01-04T00:00:00.000Z' },
      { kind: 'unknown_kind', at: '2024-01-05T00:00:00.000Z' }
    ]
  }));
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'INSUFFICIENT_ACTIVITY');
  assert.equal(result.distinctKinds, 1);
});
