import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReferralQualification } from '../src/company-os/generated/feature_67cf3216c550.mjs';

const DAY = 86400000;
const base = Date.UTC(2024, 0, 1);

function input(overrides = {}) {
  return {
    referredAtMs: base,
    nowMs: base + 10 * DAY,
    qualifyingDays: 7,
    minActiveDays: 3,
    minXp: 50,
    xp: 100,
    activeDays: [base + DAY, base + 2 * DAY, base + 3 * DAY],
    ...overrides
  };
}

test('qualifies when activity and xp thresholds are met', () => {
  const r = evaluateReferralQualification(input());
  assert.equal(r.qualified, true);
  assert.equal(r.reason, 'qualified');
  assert.equal(r.activeDays, 3);
  assert.equal(r.windowEndMs, base + 7 * DAY);
});

test('fails when activity is outside the qualifying window', () => {
  const r = evaluateReferralQualification(input({
    activeDays: [base + 8 * DAY, base + 9 * DAY, base + 10 * DAY]
  }));
  assert.equal(r.qualified, false);
  assert.equal(r.reason, 'insufficient_active_days');
  assert.equal(r.activeDays, 0);
});

test('counts distinct days, not raw events', () => {
  const r = evaluateReferralQualification(input({
    activeDays: [base + DAY, base + DAY + 1000, base + DAY + 2000]
  }));
  assert.equal(r.qualified, false);
  assert.equal(r.activeDays, 1);
  assert.equal(r.reason, 'insufficient_active_days');
});

test('rejects invalid configuration', () => {
  assert.throws(() => evaluateReferralQualification(input({ qualifyingDays: 0 })), RangeError);
  assert.throws(() => evaluateReferralQualification(input({ minActiveDays: -1 })), RangeError);
  assert.throws(() => evaluateReferralQualification(input({ nowMs: base - 1 })), RangeError);
});
