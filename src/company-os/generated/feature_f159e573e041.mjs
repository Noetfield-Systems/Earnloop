const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86400000;

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
 * `minActiveDays` distinct active days within `windowDays` of signup, and
 * the referral itself is not self-referential or duplicated.
 */
export function evaluateReferralQualification(input) {
  const {
    referrerId,
    referredId,
    signedUpAt,
    activityDays = [],
    minActiveDays = 3,
    windowDays = 14,
    alreadyRewarded = false
  } = input || {};

  if (!isUuid(referrerId) || !isUuid(referredId)) {
    return { qualified: false, reason: 'INVALID_IDENTIFIER', activeDays: 0 };
  }
  if (referrerId.toLowerCase() === referredId.toLowerCase()) {
    return { qualified: false, reason: 'SELF_REFERRAL', activeDays: 0 };
  }
  if (alreadyRewarded) {
    return { qualified: false, reason: 'ALREADY_REWARDED', activeDays: 0 };
  }
  if (!Number.isInteger(minActiveDays) || minActiveDays < 1) {
    return { qualified: false, reason: 'INVALID_POLICY', activeDays: 0 };
  }
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    return { qualified: false, reason: 'INVALID_POLICY', activeDays: 0 };
  }

  const signup = toTime(signedUpAt);
  if (signup === null) {
    return { qualified: false, reason: 'INVALID_SIGNUP_TIME', activeDays: 0 };
  }
  const windowEnd = signup + windowDays * DAY_MS;

  const distinctDays = new Set();
  for (const entry of Array.isArray(activityDays) ? activityDays : []) {
    const t = toTime(entry);
    if (t === null) continue;
    if (t < signup || t > windowEnd) continue;
    distinctDays.add(Math.floor(t / DAY_MS));
  }

  const activeDays = distinctDays.size;
  if (activeDays < minActiveDays) {
    return { qualified: false, reason: 'INSUFFICIENT_ACTIVITY', activeDays };
  }
  return { qualified: true, reason: 'QUALIFIED', activeDays };
}
