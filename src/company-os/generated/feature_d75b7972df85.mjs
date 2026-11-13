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
 * A referral qualifies only when:
 *  - referrer and referred are distinct valid UUIDs
 *  - the referral was created at or before the activity window end
 *  - the referred member performed at least `minQualifyingActions`
 *    distinct qualifying actions (check-in, puzzle completion, etc.)
 *  - the first qualifying action occurred within `windowDays` of referral
 *
 * Returns { qualified, reason, qualifyingActions, windowEndsAt }.
 */
export function evaluateReferralQualification(input) {
  const {
    referrerId,
    referredId,
    referralCreatedAt,
    actions = [],
    windowDays = 14,
    minQualifyingActions = 2,
  } = input || {};

  if (!isUuid(referrerId) || !isUuid(referredId)) {
    return { qualified: false, reason: 'INVALID_IDS', qualifyingActions: 0, windowEndsAt: null };
  }
  if (referrerId.toLowerCase() === referredId.toLowerCase()) {
    return { qualified: false, reason: 'SELF_REFERRAL', qualifyingActions: 0, windowEndsAt: null };
  }
  const created = toTime(referralCreatedAt);
  if (created === null) {
    return { qualified: false, reason: 'INVALID_REFERRAL_TIME', qualifyingActions: 0, windowEndsAt: null };
  }
  if (!Number.isInteger(windowDays) || windowDays <= 0) {
    return { qualified: false, reason: 'INVALID_WINDOW', qualifyingActions: 0, windowEndsAt: null };
  }
  if (!Number.isInteger(minQualifyingActions) || minQualifyingActions <= 0) {
    return { qualified: false, reason: 'INVALID_THRESHOLD', qualifyingActions: 0, windowEndsAt: null };
  }

  const windowEndsAt = created + windowDays * DAY_MS;
  const seen = new Set();
  let firstAt = null;

  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action || typeof action !== 'object') continue;
    const kind = action.kind;
    if (typeof kind !== 'string' || kind.length === 0) continue;
    const at = toTime(action.at);
    if (at === null) continue;
    if (at < created || at > windowEndsAt) continue;
    if (seen.has(kind)) continue;
    seen.add(kind);
    if (firstAt === null || at < firstAt) firstAt = at;
  }

  const qualifyingActions = seen.size;
  if (qualifyingActions < minQualifyingActions) {
    return {
      qualified: false,
      reason: 'INSUFFICIENT_ACTIVITY',
      qualifyingActions,
      windowEndsAt: new Date(windowEndsAt).toISOString(),
    };
  }

  return {
    qualified: true,
    reason: 'QUALIFIED',
    qualifyingActions,
    windowEndsAt: new Date(windowEndsAt).toISOString(),
    firstQualifyingAt: new Date(firstAt).toISOString(),
  };
}
