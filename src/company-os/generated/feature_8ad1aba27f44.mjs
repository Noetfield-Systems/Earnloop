const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_POLICY = Object.freeze({
  minQualifyingActions: 3,
  minDistinctDays: 2,
  minAccountAgeHours: 24,
  maxReferralsPerDay: 5
});

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0;
}

function normalizePolicy(policy) {
  const p = { ...DEFAULT_POLICY, ...(policy || {}) };
  for (const key of Object.keys(DEFAULT_POLICY)) {
    if (!isNonNegInt(p[key])) throw new Error('INVALID_POLICY:' + key);
  }
  if (p.minQualifyingActions < 1) throw new Error('INVALID_POLICY:minQualifyingActions');
  if (p.minDistinctDays < 1) throw new Error('INVALID_POLICY:minDistinctDays');
  return p;
}

function dayKey(iso) {
  return iso.slice(0, 10);
}

/**
 * Evaluate whether a referral is activity-qualified for reward protection.
 * Pure: no side effects, no currency movement. Returns a decision object.
 */
export function evaluateReferralQualification(input, policy) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const p = normalizePolicy(policy);
  const { referrerId, refereeId, refereeCreatedAt, actions, referralsToday } = input;

  if (!UUID_RE.test(referrerId || '')) throw new Error('INVALID_REFERRER');
  if (!UUID_RE.test(refereeId || '')) throw new Error('INVALID_REFEREE');
  if (referrerId === refereeId) throw new Error('SELF_REFERRAL');
  if (typeof refereeCreatedAt !== 'string' || Number.isNaN(Date.parse(refereeCreatedAt)))
    throw new Error('INVALID_CREATED_AT');
  if (!Array.isArray(actions)) throw new Error('INVALID_ACTIONS');
  if (!isNonNegInt(referralsToday)) throw new Error('INVALID_REFERRALS_TODAY');

  const reasons = [];
  const now = Date.parse(input.now || refereeCreatedAt);
  const ageHours = (now - Date.parse(refereeCreatedAt)) / 3600000;
  if (ageHours < p.minAccountAgeHours) reasons.push('ACCOUNT_TOO_NEW');

  const qualifying = actions.filter(a =>
    a && typeof a === 'object' &&
    typeof a.kind === 'string' && a.kind.length > 0 &&
    typeof a.at === 'string' && !Number.isNaN(Date.parse(a.at)) &&
    a.verified === true
  );

  if (qualifying.length < p.minQualifyingActions) reasons.push('INSUFFICIENT_ACTIONS');

  const days = new Set(qualifying.map(a => dayKey(a.at)));
  if (days.size < p.minDistinctDays) reasons.push('INSUFFICIENT_DISTINCT_DAYS');

  if (referralsToday >= p.maxReferralsPerDay) reasons.push('REFERRAL_RATE_LIMIT');

  return {
    qualified: reasons.length === 0,
    reasons,
    qualifyingActionCount: qualifying.length,
    distinctDays: days.size,
    accountAgeHours: Math.round(ageHours * 100) / 100
  };
}

/**
 * Summarize a batch of referral evaluations for reporting.
 */
export function summarizeReferralBatch(results) {
  if (!Array.isArray(results)) throw new Error('INVALID_BATCH');
  let qualified = 0;
  const reasonCounts = {};
  for (const r of results) {
    if (!r || typeof r !== 'object' || typeof r.qualified !== 'boolean')
      throw new Error('INVALID_RESULT');
    if (r.qualified) qualified++;
    for (const reason of r.reasons || []) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  return { total: results.length, qualified, rejected: results.length - qualified, reasonCounts };
}
