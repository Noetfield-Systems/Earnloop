const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86400000;

export const REFERRAL_POLICY = Object.freeze({
  minQualifyingActions: 3,
  minDistinctDays: 2,
  qualificationWindowDays: 14,
  maxSelfReferralDepth: 0
});

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function toMs(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

/**
 * Evaluate whether a referral is activity-qualified.
 * Pure: no I/O, no clock reads. Caller supplies events and policy.
 *
 * @param {object} input
 * @param {string} input.referrerId
 * @param {string} input.referredId
 * @param {Array<{type:string, at:string|number|Date}>} input.actions
 * @param {object} [input.policy]
 * @returns {{qualified:boolean, reason:string, qualifyingActions:number, distinctDays:number}}
 */
export function evaluateReferralQualification(input) {
  if (!input || typeof input !== 'object') {
    return { qualified: false, reason: 'INVALID_INPUT', qualifyingActions: 0, distinctDays: 0 };
  }
  const { referrerId, referredId, actions } = input;
  const policy = { ...REFERRAL_POLICY, ...(input.policy || {}) };

  if (!isUuid(referrerId) || !isUuid(referredId)) {
    return { qualified: false, reason: 'INVALID_IDENTITY', qualifyingActions: 0, distinctDays: 0 };
  }
  if (referrerId.toLowerCase() === referredId.toLowerCase()) {
    return { qualified: false, reason: 'SELF_REFERRAL', qualifyingActions: 0, distinctDays: 0 };
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return { qualified: false, reason: 'NO_ACTIVITY', qualifyingActions: 0, distinctDays: 0 };
  }

  const times = [];
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    if (typeof a.type !== 'string' || a.type.length === 0) continue;
    const t = toMs(a.at);
    if (!Number.isFinite(t)) continue;
    times.push(t);
  }
  if (times.length === 0) {
    return { qualified: false, reason: 'NO_VALID_ACTIVITY', qualifyingActions: 0, distinctDays: 0 };
  }

  times.sort((x, y) => x - y);
  const windowMs = policy.qualificationWindowDays * DAY_MS;
  const start = times[0];
  const inWindow = times.filter((t) => t - start <= windowMs);

  const days = new Set(inWindow.map((t) => Math.floor(t / DAY_MS)));
  const qualifyingActions = inWindow.length;
  const distinctDays = days.size;

  if (qualifyingActions < policy.minQualifyingActions) {
    return { qualified: false, reason: 'INSUFFICIENT_ACTIONS', qualifyingActions, distinctDays };
  }
  if (distinctDays < policy.minDistinctDays) {
    return { qualified: false, reason: 'INSUFFICIENT_DISTINCT_DAYS', qualifyingActions, distinctDays };
  }
  return { qualified: true, reason: 'QUALIFIED', qualifyingActions, distinctDays };
}
