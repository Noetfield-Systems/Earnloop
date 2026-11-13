import {projectToroxSourceEntry} from './reward-ledger.mjs';

/**
 * Store Torox callback evidence, never a user cash balance.
 *
 * Torox sends reversals as NEW postbacks with negative amounts and a NEW id.
 * Preserve both source events as append-only records; never mutate an earlier
 * conversion or infer a matching reversal from offer id alone.
 * https://torox.io/publisher-integration-guide/
 */
const decimalUnits = value => {
  const s = String(value);
  if (!/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,8})?$/.test(s)) throw Error('INVALID_PROVIDER_AMOUNT');
  const sign = s.startsWith('-') ? -1n : 1n;
  const [whole, part = ''] = s.replace(/^-/, '').split('.');
  return sign * (BigInt(whole) * 100000000n + BigInt((part + '00000000').slice(0, 8)));
};

export async function recordToroxPostback(pool,source) {
 const client=typeof pool.connect==='function'?await pool.connect():pool;
 try {
  await client.query('BEGIN');
  const state=source.reversal?'reversal_reported':'reported_unsettled';
  const values=[source.eventId,source.memberId,source.offerId,
    source.amountUnits,source.publisherPayoutReported,source.reversal,state];
  const inserted=await client.query(
   `INSERT INTO earnloop_torox_postbacks
    (event_id,member_id,offer_id,amount_units,publisher_payout_reported_usd,reversal,status)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id`,values);
  if(!inserted.rowCount){
   const prev=(await client.query(
    'SELECT member_id,offer_id,amount_units,publisher_payout_reported_usd,reversal FROM earnloop_torox_postbacks WHERE provider=$1 AND event_id=$2',
    ['torox',source.eventId])).rows[0];
   if(!prev||prev.member_id!==source.memberId||prev.offer_id!==source.offerId
    ||prev.reversal!==source.reversal
    ||decimalUnits(prev.amount_units)!==decimalUnits(source.amountUnits)
    ||decimalUnits(prev.publisher_payout_reported_usd)!==decimalUnits(source.publisherPayoutReported))
    throw Error('POSTBACK_ID_CONFLICT');
  }
  await projectToroxSourceEntry(client,source.eventId);
  await client.query('COMMIT');
  return {recorded:!!inserted.rowCount,duplicate:!inserted.rowCount,classification:'source_reported_unsettled'};
 }catch(error){
  await client.query('ROLLBACK');throw error;
 }finally{if(client!==pool)client.release();}
}
