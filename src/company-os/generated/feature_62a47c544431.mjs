const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-zA-Z0-9_-]{1,90}$/;
const HEX32_RE = /^[a-f0-9]{32}$/i;
const DECIMAL_RE = /^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,8})?$/;

/**
 * Pure, deterministic validation of a Torox postback query string.
 * Mirrors the shape checks in src/torox.mjs WITHOUT signature verification
 * (no crypto, no env, no network). Returns a normalized descriptor or a
 * structured rejection. Never grants payout authority.
 */
export function classifyToroxPostback(queryString) {
  if (typeof queryString !== 'string') {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  const raw = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const params = new Map();
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    if (!params.has(key)) params.set(key, value);
  }
  const id = params.get('id');
  const oid = params.get('oid') ?? params.get('OID');
  const uid = params.get('user_id');
  const sig = params.get('sig');
  const amount = params.get('amount') ?? params.get('Amount');
  const payout = params.get('payout');

  if (!ID_RE.test(id || '')) return { ok: false, reason: 'INVALID_EVENT_ID' };
  if (!ID_RE.test(oid || '')) return { ok: false, reason: 'INVALID_OFFER_ID' };
  if (!UUID_RE.test(uid || '')) return { ok: false, reason: 'INVALID_MEMBER_ID' };
  if (!HEX32_RE.test(sig || '')) return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  if (!DECIMAL_RE.test(amount || '')) return { ok: false, reason: 'INVALID_AMOUNT' };
  if (!DECIMAL_RE.test(payout || '')) return { ok: false, reason: 'INVALID_PAYOUT' };

  const reversal = Number(amount) < 0 || Number(payout) < 0;
  return {
    ok: true,
    eventId: id,
    offerId: oid,
    memberId: uid.toLowerCase(),
    amountUnits: amount,
    publisherPayoutReported: payout,
    reversal,
    signatureVerified: false,
    payoutAuthority: false
  };
}
