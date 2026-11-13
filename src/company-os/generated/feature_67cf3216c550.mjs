const DAY_MS = 86400000;

function isNonNegInt(n) {
  return Number.isInteger(n) && n >= 0;
}

function parseTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Decide whether a referral qualifies for reward based on the referred
 * member's genuine activity, not just signup. Pure and deterministic.
 *
 * @param {object} input
 * @param {number} input.referredAtMs  epoch ms when referral was recorded
 * @param {number} input.nowMs         epoch ms of evaluation
 * @param {number} input.qualifyingDays window length in days (>=1)
 * @param {number} input.minActiveDays distinct active days required (>=1)
 * @param {number} input.minXp         minimum XP earned by referred member (>=0)
 * @param {number} input.xp            referred member's current XP
 * @param {Array<number|string|Date>} input.activeDays timestamps of distinct activity
 * @returns {{qualified:boolean, reason:string, activeDays:number, windowEndMs:number}}
 */
export function evaluateReferralQualification(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input required');
  }
  const referredAtMs = parseTime(input.referredAtMs);
  const nowMs = parseTime(input.nowMs);
  if (referredAtMs === null || nowMs === null) {
    throw new TypeError('referredAtMs and nowMs must be valid times');
  }
  if (nowMs < referredAtMs) {
    throw new RangeError('nowMs precedes referredAtMs');
  }
  const qualifyingDays = input.qualifyingDays;
  const minActiveDays = input.minActiveDays;
  const minXp = input.minXp;
  const xp = input.xp;
  if (!isNonNegInt(qualifyingDays) || qualifyingDays < 1) {
    throw new RangeError('qualifyingDays must be a positive integer');
  }
  if (!isNonNegInt(minActiveDays) || minActiveDays < 1) {
    throw new RangeError('minActiveDays must be a positive integer');
  }
  if (!isNonNegInt(minXp)) {
    throw new RangeError('minXp must be a non-negative integer');
  }
  if (!isNonNegInt(xp)) {
    throw new RangeError('xp must be a non-negative integer');
  }
  const windowEndMs = referredAtMs + qualifyingDays * DAY_MS;
  const rawDays = Array.isArray(input.activeDays) ? input.activeDays : [];
  const distinct = new Set();
  for (const entry of rawDays) {
    const t = parseTime(entry);
    if (t === null) continue;
    if (t < referredAtMs || t > windowEndMs) continue;
    distinct.add(Math.floor(t / DAY_MS));
  }
  const activeDays = distinct.size;
  if (xp < minXp) {
    return { qualified: false, reason: 'insufficient_xp', activeDays, windowEndMs };
  }
  if (activeDays < minActiveDays) {
    return { qualified: false, reason: 'insufficient_active_days', activeDays, windowEndMs };
  }
  return { qualified: true, reason: 'qualified', activeDays, windowEndMs };
}
