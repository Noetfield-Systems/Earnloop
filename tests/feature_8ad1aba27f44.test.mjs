import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification, summarizeReferralBatch } from '../src/company-os/generated/feature_8ad1aba27f44.mjs';

const REFERRER = '11111111-1111-4111-8111-111111111111';
const REFEREE = '22222222-2222-4222-8222-222222222222';
const CREATED = '2024-01-01T00:00:00.000Z';
const NOW = '2024-01-05T00:00:00.000Z';

function baseInput(overrides = {}) {
  return {
    referrerId: REFERRER,
    refereeId: REFEREE,
    refereeCreatedAt: CREATED,
    now: NOW,
    referralsToday: 0,
    actions: [
      { kind: 'checkin', at: '2024-01-02T10:00:00.000Z', verified: true },
      { kind: 'puzzle', at: '2024-01-02T11:00:00.000Z', verified: true },
      { kind: 'checkin', at: '2024-01-03T09:00:00.000Z', verified: true }
    ],
    ...overrides
  };
}

test('qualifies a referee with sufficient verified activity across days', () => {
  const r = evaluateReferralQualification(baseInput());
  assert.equal(r.qualified, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.qualifyingActionCount, 3);
  assert.equal(r.distinctDays, 2);
});

test('rejects unverified actions and single-day activity', () => {
  const r = evaluateReferralQualification(baseInput({
    actions: [
      { kind: 'checkin', at: '2024-01-02T10:00:00.000Z', verified: true },
      { kind: 'puzzle', at: '2024-01-02T11:00:00.000Z', verified: false },
      { kind: 'checkin', at: '2024-01-02T12:00:00.000Z', verified: true }
    ]
  }));
  assert.equal(r.qualified, false);
  assert.ok(r.reasons.includes('INSUFFICIENT_ACTIONS'));
  assert.ok(r.reasons.includes('INSUFFICIENT_DISTINCT_DAYS'));
});

test('rejects self-referral and invalid policy', () => {
  assert.throws(() => evaluateReferralQualification(baseInput({ refereeId: REFERRER })), /SELF_REFERRAL/);
  assert.throws(() => evaluateReferralQualification(baseInput(), { minQualifyingActions: -1 }), /INVALID_POLICY/);
});

test('summarizes batch reason counts', () => {
  const ok = evaluateReferralQualification(baseInput());
  const bad = evaluateReferralQualification(baseInput({ referralsToday: 99 }));
  const s = summarizeReferralBatch([ok, bad]);
  assert.equal(s.total, 2);
  assert.equal(s.qualified, 1);
  assert.equal(s.rejected, 1);
  assert.equal(s.reasonCounts.REFERRAL_RATE_LIMIT, 1);
});
