/**
 * Earnloop <-> Torox hosted Offerwall. No duplicate rewards ledger or wallet.
 * Docs: https://torox.io/publisher-integration-guide/
 * Disabled until approved partner and credentials. Source-reported only.
 */
import crypto from 'node:crypto';
const prod = 'https://api.wall.torox.io';
const stage = 'https://api.wall.stage.torox.io';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[a-f0-9]{32}$/i;
const ID = /^[a-zA-Z0-9_-]{1,90}$/;
const DECIMAL = /^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,8})?$/;

export function toroxConfigured(env = process.env) {
  return env.TOROX_PUBLISHER_APPROVED === 'true'
    && !!env.TOROX_APPROVAL_REFERENCE?.trim()
    && ID.test(env.TOROX_PLACEMENT_ID || '')
    && typeof env.TOROX_APP_TOKEN === 'string'
    && env.TOROX_APP_TOKEN.length >= 16
    && (env.TOROX_MODE === 'production' || env.TOROX_MODE === 'staging');
}

export function toroxBase(env = process.env) {
  return env.TOROX_MODE === 'staging' ? stage : prod;
}

export async function createToroxWallSession(memberId, { env = process.env, fetcher = fetch } = {}) {
  if (!toroxConfigured(env)) throw new Error('PUBLISHER_NOT_APPROVED');
  if (!UUID.test(memberId)) throw new Error('INVALID_MEMBER');
  const uri = new URL('/partner/session', toroxBase(env));
  uri.searchParams.set('placement_id', env.TOROX_PLACEMENT_ID);
  uri.searchParams.set('token', env.TOROX_APP_TOKEN);
  const result = await fetcher(uri, {
    method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ player: { uid: memberId } }),
    signal: AbortSignal.timeout(8000)
  });
  if (!result.ok) throw new Error('PARTNER_SESSION_ERROR');
  const info = await result.json();
  if (info?.ok !== true || typeof info.wall_url !== 'string') throw new Error('PARTNER_SESSION_UNAVAILABLE');
  const wall = new URL(info.wall_url);
  const permitted = env.TOROX_MODE === 'staging'
    ? ['wall.stage.torox.io', 'wall.torox.io'] : ['wall.torox.io'];
  if (wall.protocol !== 'https:' || !permitted.includes(wall.hostname) || wall.username || wall.password)
    throw new Error('PARTNER_WALL_ORIGIN_REJECTED');
  return wall.toString();
}

/**
 * Publisher signature = MD5(offer_id + "-" + user_id + "-" + app token).
 * Torox mandates this legacy scheme; source reports grant NO payout authority.
 * Require TLS, idempotency and optional network IP allowlisting.
 */
export function parseToroxPostback(uri, env = process.env) {
  if (!toroxConfigured(env)) throw new Error('PUBLISHER_NOT_APPROVED');
  const query = uri.searchParams;
  const id = query.get('id');
  const oid = query.get('oid') || query.get('OID');
  const uid = query.get('user_id');
  const sig = query.get('sig');
  const amount = query.get('amount') || query.get('Amount');
  const payout = query.get('payout');
  if (!ID.test(id || '') || !ID.test(oid || '') || !UUID.test(uid || '')
      || !HEX.test(sig || '') || !DECIMAL.test(amount || '') || !DECIMAL.test(payout || ''))
    throw new Error('INVALID_POSTBACK');
  const expected = crypto.createHash('md5').update(oid + '-' + uid + '-' + env.TOROX_APP_TOKEN).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig.toLowerCase(), 'hex'), Buffer.from(expected, 'hex')))
    throw new Error('BAD_POSTBACK_SIGNATURE');
  const reversal = Number(amount) < 0 || Number(payout) < 0;
  return { provider: 'torox', eventId: id, offerId: oid, memberId: uid, amountUnits: amount,
    publisherPayoutReported: payout, reversal };
}
