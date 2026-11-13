const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_POLICY = Object.freeze({
  minQualifyingActions: 3,
  minDistinctDays: 2,
  minAccountAgeHours: 24,
  maxReferralsPerDay: 5,
  selfReferralBlocked: true
});

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function normalizePolicy(policy) {
  const p = { ...DEFAULT_POLICY, ...(policy || {}) };
  for (const key of ['minQualifyingActions', 'minDistinctDays', 'minAccountAgeHours', 'maxReferralsPerDay']) {
    if (!Number.isInteger(p[key]) || p[key] < 0) {
      throw new Error('INVALID_POLICY:' + key);
    }
  }
  return p;
}

/**
 * Evaluate whether a referral is activity-qualified for reward protection.
 * Pure and deterministic: caller supplies all facts, no clock or I/O.
 * Returns { qualified, reasons, distinctDays, qualifyingActions }.
 */
export function evaluateReferralQualification(input, policy) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const p = normalizePolicy(policy);
  const reasons = [];

  const referrerId = input.referrerId;
  const refereeId = input.refereeId;
  if (!isNonEmptyString(referrerId) || !isNonEmptyString(refereeId)) {
    throw new Error('INVALID_IDS');
  }
  if (p.selfReferralBlocked && referrerId === refereeId) {
    reasons.push('SELF_REFERRAL');
  }

  const accountCreatedMs = toMs(input.refereeAccountCreatedAt);
  const nowMs = toMs(input.now);
  if (accountCreatedMs === null || nowMs === null) throw new Error('INVALID_TIMESTAMPS');
  if (nowMs < accountCreatedMs) throw new Error('INVALID_TIMESTAMPS');
  const ageHours = (nowMs - accountCreatedMs) / 3600000;
  if (ageHours < p.minAccountAgeHours) reasons.push('ACCOUNT_TOO_NEW');

  const actions = Array.isArray(input.qualifyingActions) ? input.qualifyingActions : [];
  const validActions = [];
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    if (!isNonEmptyString(a.kind)) continue;
    const at = toMs(a.at);
    if (at === null) continue;
    if (at < accountCreatedMs || at > nowMs) continue;
    validActions.push({ kind: a.kind, at });
  }
  const qualifyingActions = validActions.length;
  if (qualifyingActions < p.minQualifyingActions) reasons.push('INSUFFICIENT_ACTIONS');

  const dayKeys = new Set(validActions.map(a => new Date(a.at).toISOString().slice(0, 10)));
  const distinctDays = dayKeys.size;
  if (distinctDays < p.minDistinctDays) reasons.push('INSUFFICIENT_DISTINCT_DAYS');

  const referralsToday = Number.isInteger(input.referralsToday) ? input.referralsToday : 0;
  if (referralsToday >= p.maxReferralsPerDay) reasons.push('REFERRAL_RATE_LIMIT');

  return {
    qualified: reasons.length === 0,
    reasons,
    distinctDays,
    qualifyingActions
  };
}

/**
 * Summarize a batch of referral evaluations into counts for reporting.
 * Pure: no side effects, deterministic ordering of reason tallies.
 */
export function summarizeReferralBatch(results) {
  if (!Array.isArray(results)) throw new Error('INVALID_BATCH');
  let qualified = 0;
  const reasonCounts = {};
  for (const r of results) {
    if (!r || typeof r !== 'object' || typeof r.qualified !== 'boolean') {
      throw new Error('INVALID_BATCH_ENTRY');
    }
    if (r.qualified) qualified += 1;
    for (const reason of Array.isArray(r.reasons) ? r.reasons : []) {
      if (typeof reason !== 'string') continue;
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  const sortedReasons = Object.keys(reasonCounts).sort().reduce((acc, k) => {
    acc[k] = reasonCounts[k];
    return acc;
  }, {});
  return { total: results.length, qualified, unqualified: results.length - qualified, reasonCounts: sortedReasons };
}
