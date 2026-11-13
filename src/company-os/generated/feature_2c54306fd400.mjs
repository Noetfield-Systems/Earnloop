const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function toTime(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Decide whether a referral qualifies for reward based on the referred
 * member's genuine activity. Pure and deterministic: no clock, no I/O.
 *
 * A referral qualifies only when the referred member has at least
 * `minQualifyingActions` distinct qualifying actions recorded at or after
 * the referral was created, and the referral is at least `minAgeDays` old.
 * Self-referrals and malformed input never qualify.
 */
export function evaluateReferralQualification(input) {
  const {
    referrerId,
    referredId,
    referralCreatedAt,
    now,
    qualifyingActions = [],
    minQualifyingActions = 2,
    minAgeDays = 1
  } = input || {};

  const reasons = [];

  if (!isUuid(referrerId) || !isUuid(referredId)) {
    return { qualified: false, reasons: ['invalid_member_id'], qualifyingActionCount: 0 };
  }
  if (referrerId.toLowerCase() === referredId.toLowerCase()) {
    return { qualified: false, reasons: ['self_referral'], qualifyingActionCount: 0 };
  }

  const createdMs = toTime(referralCreatedAt);
  const nowMs = toTime(now);
  if (createdMs === null || nowMs === null) {
    return { qualified: false, reasons: ['invalid_timestamp'], qualifyingActionCount: 0 };
  }
  if (nowMs < createdMs) {
    return { qualified: false, reasons: ['now_before_referral'], qualifyingActionCount: 0 };
  }

  const seen = new Set();
  for (const action of Array.isArray(qualifyingActions) ? qualifyingActions : []) {
    if (!action || typeof action !== 'object') continue;
    const at = toTime(action.at);
    if (at === null || at < createdMs) continue;
    const key = typeof action.id === 'string' && action.id ? action.id : null;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    } else {
      seen.add(`anon:${at}:${action.kind || ''}`);
    }
  }
  const qualifyingActionCount = seen.size;

  const ageMs = nowMs - createdMs;
  const ageDays = ageMs / DAY_MS;

  if (ageDays < minAgeDays) reasons.push('referral_too_new');
  if (qualifyingActionCount < minQualifyingActions) reasons.push('insufficient_activity');

  return {
    qualified: reasons.length === 0,
    reasons,
    qualifyingActionCount,
    ageDays: Math.floor(ageDays)
  };
}
