import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyToroxPostback } from '../src/company-os/generated/feature_62a47c544431.mjs';

const MEMBER = '11111111-2222-3333-4444-555555555555';
const SIG = 'a'.repeat(32);

function qs(overrides = {}) {
  const base = {
    id: 'evt_1',
    oid: 'offer_42',
    user_id: MEMBER,
    sig: SIG,
    amount: '10',
    payout: '2.5'
  };
  const merged = { ...base, ...overrides };
  return Object.entries(merged)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

test('accepts a well-formed positive postback and never grants payout authority', () => {
  const r = classifyToroxPostback('?' + qs());
  assert.equal(r.ok, true);
  assert.equal(r.eventId, 'evt_1');
  assert.equal(r.offerId, 'offer_42');
  assert.equal(r.memberId, MEMBER);
  assert.equal(r.reversal, false);
  assert.equal(r.signatureVerified, false);
  assert.equal(r.payoutAuthority, false);
});

test('flags reversal when amount or payout is negative', () => {
  const r = classifyToroxPostback(qs({ amount: '-5' }));
  assert.equal(r.ok, true);
  assert.equal(r.reversal, true);
  assert.equal(r.payoutAuthority, false);
});

test('rejects malformed member id and bad signature format with specific reasons', () => {
  const badMember = classifyToroxPostback(qs({ user_id: 'not-a-uuid' }));
  assert.deepEqual(badMember, { ok: false, reason: 'INVALID_MEMBER_ID' });

  const badSig = classifyToroxPostback(qs({ sig: 'zz' }));
  assert.deepEqual(badSig, { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' });

  const badAmount = classifyToroxPostback(qs({ amount: '1e3' }));
  assert.deepEqual(badAmount, { ok: false, reason: 'INVALID_AMOUNT' });
});

test('rejects non-string input and missing required fields', () => {
  assert.deepEqual(classifyToroxPostback(null), { ok: false, reason: 'INVALID_INPUT' });
  const missing = classifyToroxPostback(qs({ id: undefined }));
  assert.deepEqual(missing, { ok: false, reason: 'INVALID_EVENT_ID' });
});
