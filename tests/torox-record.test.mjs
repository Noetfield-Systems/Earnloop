import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {recordToroxPostback} from '../src/torox-record.mjs';
import {setupRewardLedger,memberRewardStatus} from '../src/reward-ledger.mjs';

test('Torox idempotency and independent reversal IDs preserve immutable source evidence', async () => {
  const db = new PGlite();
  const pool = {async query(sql, params) {
    const r = await db.query(sql, params);
    return {...r, rowCount: r.affectedRows ?? r.rows.length};
  }};
  try {
    await db.exec(`
      CREATE TABLE earnloop_members(id UUID PRIMARY KEY);
      CREATE TABLE earnloop_torox_postbacks(
        provider TEXT NOT NULL DEFAULT 'torox',event_id TEXT NOT NULL,
        member_id UUID NOT NULL REFERENCES earnloop_members(id),offer_id TEXT NOT NULL,
        amount_units NUMERIC(18,8) NOT NULL,publisher_payout_reported_usd NUMERIC(18,8) NOT NULL,
        reversal BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'reported_unsettled'
          CHECK(status IN ('reported_unsettled','reversal_reported','reviewed')),
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,event_id)
      );
    `);
    await setupRewardLedger(pool);
    const memberId = '11111111-1111-4111-8111-111111111111';
    await pool.query('INSERT INTO earnloop_members(id) VALUES($1)', [memberId]);
    const earned = {eventId:'earned-1',memberId,offerId:'offer-12',
      amountUnits:'20.25000000',publisherPayoutReported:'1.50',reversal:false};
    assert.equal((await recordToroxPostback(pool, earned)).recorded, true);
    assert.equal((await recordToroxPostback(pool, {...earned,amountUnits:'20.25'})).duplicate, true);
    await assert.rejects(recordToroxPostback(pool, {...earned,amountUnits:'200.25'}), /POSTBACK_ID_CONFLICT/);
    await assert.rejects(recordToroxPostback(pool, {...earned,memberId:'22222222-2222-4222-8222-222222222222'}), /POSTBACK_ID_CONFLICT/);
    const reversed = {...earned,eventId:'reversal-2',amountUnits:'-20.25',
      publisherPayoutReported:'-1.50',reversal:true};
    assert.equal((await recordToroxPostback(pool, reversed)).recorded, true);
    assert.equal((await recordToroxPostback(pool, reversed)).duplicate, true);
    const rows = (await pool.query('SELECT event_id,status,amount_units FROM earnloop_torox_postbacks ORDER BY event_id')).rows;
    assert.deepEqual(rows.map(r=>r.event_id),['earned-1','reversal-2']);
    assert.deepEqual(rows.map(r=>r.status),['reported_unsettled','reversal_reported']);
    assert.deepEqual(rows.map(r=>Number(r.amount_units)),[20.25,-20.25]);
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM earnloop_torox_postbacks')).rows[0].n,2);
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM earnloop_reward_source_entries')).rows[0].n,2);
    const balance=await memberRewardStatus(pool,memberId);
    assert.equal(balance.source.event_count,2);
    assert.equal(balance.source.conversions_reported,1);
    assert.equal(balance.source.reversals_reported,1);
    assert.equal(Number(balance.source.net_reported_units),0);
    assert.equal(balance.cash.available_for_redemption_minor,0);
    assert.equal(balance.cash.pending_rewards_minor,null);
    assert.equal(balance.cash.payouts_enabled,false);
    await setupRewardLedger(pool);
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM earnloop_reward_source_entries')).rows[0].n,2);
    assert.equal((await memberRewardStatus(pool,'22222222-2222-4222-8222-222222222222')).source.event_count,0);
  } finally { await db.close(); }
});
