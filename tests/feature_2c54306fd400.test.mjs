import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification } from '../src/company-os/generated/feature_2c54306fd400.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFERRED = '22222222-2222-4222-8222-222222222222';
const CREATED = '2024-01-01T00:00:00.000Z';
const NOW = '2024-01-05T00:00:00.000Z';

function base(overrides = {}) {
  return {
    referrerId: REFERRER,
    referredId: REFERRED,
    referralCreatedAt: CREATED,
    now: NOW,
    qualifyingActions: [
      { id: 'a1', kind: 'checkin', at: '2024-01-02T00:00:00.000Z' },
      { id: 'a2', kind: 'puzzle', at: '2024-01-03T00:00:00.000Z' }
    ],
    ...overrides
  };
}

test('qualifies with enough distinct post-referral activity and age', () => {
  const r = evaluateReferralQualification(base());
  assert.equal(r.qualified, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.qualifyingActionCount, 2);
  assert.equal(r.ageDays, 4);
});

test('rejects insufficient activity and duplicate action ids', () => {
  const r = evaluateReferralQualification(base({
    qualifyingActions: [
      { id: 'a1', kind: 'checkin', at: '2024-01-02T00:00:00.000Z' },
      { id: 'a1', kind: 'checkin', at: '2024-01-02T00:00:00.000Z' }
    ]
  }));
  assert.equal(r.qualified, false);
  assert.ok(r.reasons.includes('insufficient_activity'));
  assert.equal(r.qualifyingActionCount, 1);
});

test('ignores activity before referral creation and rejects self-referral', () => {
  const pre = evaluateReferralQualification(base({
    qualifyingActions: [
      { id: 'old1', kind: 'checkin', at: '2023-12-31T00:00:00.000Z' },
      { id: 'old2', kind: 'puzzle', at: '2023-12-30T00:00:00.000Z' }
    ]
  }));
  assert.equal(pre.qualified, false);
  assert.equal(pre.qualifyingActionCount, 0);

  const self = evaluateReferralQualification(base({ referredId: REFERRER }));
  assert.equal(self.qualified, false);
  assert.deepEqual(self.reasons, ['self_referral']);
});

test('rejects too-new referral and malformed timestamps', () => {
  const young = evaluateReferralQualification(base({ now: '2024-01-01T06:00:00.000Z' }));
  assert.equal(young.qualified, false);
  assert.ok(young.reasons.includes('referral_too_new'));

  const bad = evaluateReferralQualification(base({ now: 'not-a-date' }));
  assert.equal(bad.qualified, false);
  assert.deepEqual(bad.reasons, ['invalid_timestamp']);
});
