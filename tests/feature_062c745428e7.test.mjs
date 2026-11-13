import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification, summarizeReferralBatch } from '../src/company-os/generated/feature_062c745428e7.mjs';

const baseNow = '2024-06-10T12:00:00.000Z';
const created = '2024-06-08T00:00:00.000Z';

function goodInput(overrides = {}) {
  return {
    referrerId: 'user-a',
    refereeId: 'user-b',
    refereeAccountCreatedAt: created,
    now: baseNow,
    qualifyingActions: [
      { kind: 'checkin', at: '2024-06-08T09:00:00.000Z' },
      { kind: 'puzzle', at: '2024-06-09T10:00:00.000Z' },
      { kind: 'checkin', at: '2024-06-10T08:00:00.000Z' }
    ],
    referralsToday: 0,
    ...overrides
  };
}

test('qualifies an active referee across multiple days', () => {
  const r = evaluateReferralQualification(goodInput());
  assert.equal(r.qualified, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.qualifyingActions, 3);
  assert.equal(r.distinctDays, 3);
});

test('rejects self-referral and insufficient activity', () => {
  const r = evaluateReferralQualification(goodInput({
    refereeId: 'user-a',
    qualifyingActions: [{ kind: 'checkin', at: '2024-06-09T10:00:00.000Z' }]
  }));
  assert.equal(r.qualified, false);
  assert.ok(r.reasons.includes('SELF_REFERRAL'));
  assert.ok(r.reasons.includes('INSUFFICIENT_ACTIONS'));
  assert.ok(r.reasons.includes('INSUFFICIENT_DISTINCT_DAYS'));
});

test('ignores out-of-window actions and enforces rate limit', () => {
  const r = evaluateReferralQualification(goodInput({
    referralsToday: 5,
    qualifyingActions: [
      { kind: 'checkin', at: '2024-06-01T00:00:00.000Z' },
      { kind: 'puzzle', at: '2024-06-09T10:00:00.000Z' },
      { kind: 'checkin', at: '2024-06-11T00:00:00.000Z' }
    ]
  }));
  assert.equal(r.qualified, false);
  assert.equal(r.qualifyingActions, 1);
  assert.ok(r.reasons.includes('REFERRAL_RATE_LIMIT'));
  assert.ok(r.reasons.includes('INSUFFICIENT_ACTIONS'));
});

test('throws on invalid timestamps and summarizes a batch', () => {
  assert.throws(() => evaluateReferralQualification(goodInput({ now: 'not-a-date' })), /INVALID_TIMESTAMPS/);
  const summary = summarizeReferralBatch([
    evaluateReferralQualification(goodInput()),
    evaluateReferralQualification(goodInput({ referralsToday: 9 }))
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.qualified, 1);
  assert.equal(summary.unqualified, 1);
  assert.equal(summary.reasonCounts.REFERRAL_RATE_LIMIT, 1);
});
