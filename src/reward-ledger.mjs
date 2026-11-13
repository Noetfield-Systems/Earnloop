/**
 * Independent read model of provider source reports. No source callback is
 * cash, an advertiser settlement or a funded member entitlement.
 *
 * The legacy callback table is retained. The journal is append-only, keyed by
 * the original provider event ID; backfill is idempotent across deploys.
 */
export async function setupRewardLedger(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earnloop_reward_source_entries (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      member_id UUID NOT NULL REFERENCES earnloop_members(id),
      offer_id TEXT NOT NULL,
      event_kind TEXT NOT NULL CHECK(event_kind IN ('conversion_report','reversal_report')),
      reward_units NUMERIC(18,8) NOT NULL,
      reported_publisher_usd NUMERIC(18,8) NOT NULL,
      classification TEXT NOT NULL DEFAULT 'source_reported_unsettled'
        CHECK(classification='source_reported_unsettled'),
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(provider,event_id),
      CHECK (
        (event_kind='conversion_report' AND reward_units>=0 AND reported_publisher_usd>=0)
        OR (event_kind='reversal_report' AND reward_units<=0 AND reported_publisher_usd<=0)
      )
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS earnloop_reward_source_member_idx
      ON earnloop_reward_source_entries(member_id,received_at DESC)`);
  // Old source callbacks have no independent cash settlement proof. Keep
  // them visibly SOURCE_REPORTED even when migrating into the new journal.
  await pool.query(`
    INSERT INTO earnloop_reward_source_entries
      (provider,event_id,member_id,offer_id,event_kind,reward_units,reported_publisher_usd,received_at)
    SELECT provider,event_id,member_id,offer_id,
      CASE WHEN reversal THEN 'reversal_report' ELSE 'conversion_report' END,
      amount_units,publisher_payout_reported_usd,received_at
    FROM earnloop_torox_postbacks
    ON CONFLICT(provider,event_id) DO NOTHING
  `);
}

/**
 * Project exactly one immutable source report already persisted in the
 * canonical Torox postback table. Called in the same DB transaction as
 * recordToroxPostback so retries cannot create a half-recorded callback.
 */
export async function projectToroxSourceEntry(client,eventId) {
  const r=await client.query(`
    INSERT INTO earnloop_reward_source_entries
      (provider,event_id,member_id,offer_id,event_kind,reward_units,reported_publisher_usd,received_at)
    SELECT provider,event_id,member_id,offer_id,
      CASE WHEN reversal THEN 'reversal_report' ELSE 'conversion_report' END,
      amount_units,publisher_payout_reported_usd,received_at
    FROM earnloop_torox_postbacks
    WHERE provider='torox' AND event_id=$1
    ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id
  `,[eventId]);
  if(r.rowCount) return true;
  const existing=await client.query(
    'SELECT event_id FROM earnloop_reward_source_entries WHERE provider=$1 AND event_id=$2',
    ['torox',eventId]);
  if(!existing.rows[0]) throw Error('REWARD_SOURCE_PROJECTION_MISSING');
  return false;
}

export async function memberRewardStatus(pool,memberId) {
  const {rows}=await pool.query(`
    SELECT COUNT(*)::int AS event_count,
      COUNT(*) FILTER(WHERE event_kind='conversion_report')::int AS conversions_reported,
      COUNT(*) FILTER(WHERE event_kind='reversal_report')::int AS reversals_reported,
      COALESCE(SUM(reward_units) FILTER(WHERE event_kind='conversion_report'),0)::text AS reported_units,
      COALESCE(SUM(reward_units) FILTER(WHERE event_kind='reversal_report'),0)::text AS reversal_units,
      COALESCE(SUM(reward_units),0)::text AS net_reported_units
    FROM earnloop_reward_source_entries WHERE member_id=$1
  `,[memberId]);
  const events=await pool.query(`
    SELECT provider,event_id,offer_id,event_kind,reward_units::text AS reward_units,
      classification,received_at
    FROM earnloop_reward_source_entries WHERE member_id=$1
    ORDER BY received_at DESC,event_id DESC LIMIT 30
  `,[memberId]);
  const counts=rows[0];
  return {
    schema:'earnloop.reward-ledger.v1',
    provenance:'APPEND_ONLY_PROVIDER_SOURCE_EVENTS',
    source:{
      event_count:counts.event_count,
      conversions_reported:counts.conversions_reported,
      reversals_reported:counts.reversals_reported,
      reported_units:counts.reported_units,
      reversal_units:counts.reversal_units,
      net_reported_units:counts.net_reported_units,
      currency:'PROVIDER_UNITS',
      status:'SOURCE_REPORTED_UNSETTLED',
      notice:'Reversals are independent signed source reports; matching them to an original conversion requires provider evidence. Units are not cash.'
    },
    cash:{
      currency:null,
      pending_rewards_minor:null,
      confirmed_rewards_minor:0,
      available_for_redemption_minor:0,
      redeemed_rewards_minor:0,
      reversed_rewards_minor:null,
      independently_settled_revenue_minor:null,
      classification:'NO_VERIFIED_REWARD_ENTITLEMENT',
      payouts_enabled:false
    },
    events:events.rows,
    next_action:'Provider approval, conversion validation, settlement reconciliation, reward allocation and funded payout are required before cash credits.'
  };
}
