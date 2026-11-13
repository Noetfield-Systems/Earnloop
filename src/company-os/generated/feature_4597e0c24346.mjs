const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIVITY_KINDS = new Set(['checkin', 'puzzle_complete', 'membership_active']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function normalizeActivity(entry) {
  if (!isPlainObject(entry)) return null;
  const kind = entry.kind;
  if (!ACTIVITY_KINDS.has(kind)) return null;
  const at = entry.at;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  return { kind, at: Date.parse(at) };
}

/**
 * Decide whether a referral qualifies for reward based on the referred member's
 * genuine activity. Pure and deterministic: no I/O, no clock, no randomness.
 *
 * Rules:
 *  - referrer and referred must be distinct valid UUIDs
 *  - referred must have at least `minDistinctKinds` distinct qualifying activity kinds
 *  - all qualifying activity must occur at or after `referredJoinedAt`
 *  - activity must occur within `windowDays` of the referral creation
 *  - self-referral, missing activity, or out-of-window activity => not qualified
 */
export function evaluateReferralQualification(input) {
  if (!isPlainObject(input)) {
    return { qualified: false, reason: 'INVALID_INPUT', distinctKinds: 0 };
  }
  const {
    referrerId,
    referredId,
    referredJoinedAt,
    referralCreatedAt,
    activity,
    minDistinctKinds = 2,
    windowDays = 14
  } = input;

  if (typeof referrerId !== 'string' || !UUID_RE.test(referrerId)) {
    return { qualified: false, reason: 'INVALID_REFERRER', distinctKinds: 0 };
  }
  if (typeof referredId !== 'string' || !UUID_RE.test(referredId)) {
    return { qualified: false, reason: 'INVALID_REFERRED', distinctKinds: 0 };
  }
  if (referrerId.toLowerCase() === referredId.toLowerCase()) {
    return { qualified: false, reason: 'SELF_REFERRAL', distinctKinds: 0 };
  }
  if (!Number.isInteger(minDistinctKinds) || minDistinctKinds < 1) {
    return { qualified: false, reason: 'INVALID_THRESHOLD', distinctKinds: 0 };
  }
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    return { qualified: false, reason: 'INVALID_WINDOW', distinctKinds: 0 };
  }
  const joinedMs = typeof referredJoinedAt === 'string' ? Date.parse(referredJoinedAt) : NaN;
  const createdMs = typeof referralCreatedAt === 'string' ? Date.parse(referralCreatedAt) : NaN;
  if (Number.isNaN(joinedMs) || Number.isNaN(createdMs)) {
    return { qualified: false, reason: 'INVALID_TIMESTAMPS', distinctKinds: 0 };
  }
  if (createdMs < joinedMs) {
    return { qualified: false, reason: 'REFERRAL_BEFORE_JOIN', distinctKinds: 0 };
  }
  if (!Array.isArray(activity)) {
    return { qualified: false, reason: 'INVALID_ACTIVITY', distinctKinds: 0 };
  }

  const windowEndMs = createdMs + windowDays * 24 * 60 * 60 * 1000;
  const kinds = new Set();
  for (const raw of activity) {
    const norm = normalizeActivity(raw);
    if (!norm) continue;
    if (norm.at < joinedMs) continue;
    if (norm.at < createdMs) continue;
    if (norm.at > windowEndMs) continue;
    kinds.add(norm.kind);
  }

  const distinctKinds = kinds.size;
  if (distinctKinds < minDistinctKinds) {
    return { qualified: false, reason: 'INSUFFICIENT_ACTIVITY', distinctKinds };
  }
  return { qualified: true, reason: 'QUALIFIED', distinctKinds };
}
