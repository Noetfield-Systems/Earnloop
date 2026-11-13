import crypto from 'node:crypto';
export async function setupMemberLoop(pool){await pool.query(`
CREATE TABLE IF NOT EXISTS earnloop_activity(id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES earnloop_members(id),kind TEXT NOT NULL,event_key TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,event_key));
CREATE TABLE IF NOT EXISTS earnloop_campaigns(id TEXT PRIMARY KEY,title TEXT NOT NULL,state TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS earnloop_support(id UUID PRIMARY KEY,member_id UUID NOT NULL REFERENCES earnloop_members(id),subject TEXT NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'open',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS earnloop_sponsor_leads(id UUID PRIMARY KEY,email TEXT NOT NULL,brief TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'new',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS earnloop_game_rounds(id UUID PRIMARY KEY,member_id UUID NOT NULL REFERENCES earnloop_members(id),day DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::DATE,answer INT NOT NULL,attempts INT NOT NULL DEFAULT 0,completed BOOLEAN NOT NULL DEFAULT FALSE,UNIQUE(member_id,day));
CREATE INDEX IF NOT EXISTS earnloop_activity_member_idx ON earnloop_activity(member_id,created_at);
`);}
export async function activity(pool,id,kind,key,details={}){await pool.query('INSERT INTO earnloop_activity(member_id,kind,event_key,details) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,kind,key,JSON.stringify(details)]);}
/**
 * Count referral activity, not simply account creations. A qualifying
 * referral checked in AND completed an actual puzzle (two separate actions).
 * This is non-cash engagement, not identity proof, a paid conversion, or
 * permission to issue a referral payout.
 */
export async function referralOverview(pool,referrerId){
 const r=await pool.query(`
  SELECT COUNT(*)::int AS joined,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM earnloop_activity a
             WHERE a.member_id=invitee.id AND a.kind='daily_checkin'
           )
           AND EXISTS (
             SELECT 1 FROM earnloop_activity a
             WHERE a.member_id=invitee.id AND a.kind='puzzle_completed'
           )
         )::int AS activity_qualified
  FROM earnloop_members invitee
  WHERE invitee.referrer_id=$1
 `,[referrerId]);
 const joined=r.rows[0]?.joined||0;
 const qualified=r.rows[0]?.activity_qualified||0;
 return {joined,activity_qualified:qualified,pending:joined-qualified,
         criterion:'one check-in and one completed puzzle by the invitee',
         identity_verified:false,payable:false,cash_reward_minor:0};
}
/**
 * Read-only activation evidence from the existing member/activity tables.
 * "Member" means a stored session, not an independently verified human.
 * Activation requires both a UTC check-in and a completed puzzle; a mere
 * signup, repeated event, or virtual XP credit never becomes cash revenue.
 */
export async function activationFunnel(pool){
 const r=await pool.query(`
   SELECT COUNT(*)::int AS signups,
          COUNT(*) FILTER(WHERE m.created_at >= NOW()-INTERVAL '7 days')::int AS signups_7d,
          COUNT(*) FILTER(WHERE EXISTS (
            SELECT 1 FROM earnloop_activity a
            WHERE a.member_id=m.id AND a.kind='daily_checkin'
          ))::int AS checked_in,
          COUNT(*) FILTER(WHERE EXISTS (
            SELECT 1 FROM earnloop_activity a
            WHERE a.member_id=m.id AND a.kind='puzzle_completed'
          ))::int AS played,
          COUNT(*) FILTER(WHERE EXISTS (
            SELECT 1 FROM earnloop_activity a
            WHERE a.member_id=m.id AND a.kind='daily_checkin'
          ) AND EXISTS (
            SELECT 1 FROM earnloop_activity a
            WHERE a.member_id=m.id AND a.kind='puzzle_completed'
          ))::int AS activated,
          COUNT(*) FILTER(WHERE m.created_at >= NOW()-INTERVAL '7 days'
            AND EXISTS (SELECT 1 FROM earnloop_activity a
                        WHERE a.member_id=m.id AND a.kind='daily_checkin')
            AND EXISTS (SELECT 1 FROM earnloop_activity a
                        WHERE a.member_id=m.id AND a.kind='puzzle_completed')
          )::int AS activated_7d
   FROM earnloop_members m
 `);
 const v=r.rows[0];
 const signups=Number(v.signups)||0,activated=Number(v.activated)||0;
 const signups7d=Number(v.signups_7d)||0,activated7d=Number(v.activated_7d)||0;
 return {schema:'earnloop.member-activation.v1',source:'POSTGRES_EARNLOOP_MEMBERS_AND_ACTIVITY',
   signups,checked_in:Number(v.checked_in)||0,played:Number(v.played)||0,
   activated,activation_rate:signups?Number((activated/signups).toFixed(4)):null,
   signups_7d:signups7d,activated_7d:activated7d,
   activation_rate_7d:signups7d?Number((activated7d/signups7d).toFixed(4)):null,
   activation_definition:'member has at least one daily_checkin AND one puzzle_completed',
   counts_unique_people:false,revenue_proven:false,cash_payouts_enabled:false};
}
export async function publishCampaign(pool){await pool.query("INSERT INTO earnloop_campaigns(id,title,state) VALUES('founding-seven','Seven days of momentum','active') ON CONFLICT DO NOTHING");return {kind:'campaign_published',path:'/challenge',campaign_id:'founding-seven',reward:'noncash XP',completion_state:'implemented',external_action_executed:false};}
export async function memberJourney(pool,m){
 const rows=await pool.query('SELECT kind,details,created_at FROM earnloop_activity WHERE member_id=$1 ORDER BY created_at DESC LIMIT 60',[m.id]);
 const days=await pool.query("SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date)::int n FROM earnloop_activity WHERE member_id=$1 AND kind='daily_checkin'",[m.id]);
 const cases=await pool.query('SELECT id,subject,state,created_at FROM earnloop_support WHERE member_id=$1 ORDER BY created_at DESC LIMIT 10',[m.id]);
 const rank=await pool.query('SELECT COUNT(*)::int n FROM earnloop_members WHERE created_at<=$1',[m.created_at]);
 const partner=await pool.query('SELECT event_id,offer_id,amount_units,reversal,status,received_at FROM earnloop_torox_postbacks WHERE member_id=$1 ORDER BY received_at DESC,event_id DESC LIMIT 30',[m.id]);
 return {activity:rows.rows,support:cases.rows,partner_reports:partner.rows,challenge:{days:Math.min(7,days.rows[0].n),target:7,bonus_xp:70},founding_member:rank.rows[0].n<=500,rewards:{xp:m.xp,payouts_enabled:false,pending_partner_reports:partner.rowCount,approved_reward_minor:0,fulfilled_minor:0,currency:null},campaigns:(await pool.query("SELECT id,title FROM earnloop_campaigns WHERE state='active'")).rows};
}
export async function claimChallenge(pool,m){
 const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM earnloop_members WHERE id=$1 FOR UPDATE',[m.id]);
 const r=await c.query("SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date)::int n FROM earnloop_activity WHERE member_id=$1 AND kind='daily_checkin'",[m.id]);
 if(r.rows[0].n<7)throw Error('Complete seven distinct UTC check-in days first');
 const done=await c.query("INSERT INTO earnloop_activity(member_id,kind,event_key,details) VALUES($1,'challenge_completed','founding-seven','{\"xp\":70}') ON CONFLICT DO NOTHING RETURNING id",[m.id]);
 if(done.rowCount)await c.query('UPDATE earnloop_members SET xp=xp+70 WHERE id=$1',[m.id]);await c.query('COMMIT');return {awarded:!!done.rowCount,xp:done.rowCount?70:0};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function game(pool,m,answer){
 const c=await pool.connect();try{await c.query('BEGIN');
 const a=crypto.randomInt(2,20),b=crypto.randomInt(2,20);
 await c.query('INSERT INTO earnloop_game_rounds(id,member_id,answer) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[crypto.randomUUID(),m.id,a+b]);
 const row=(await c.query("SELECT * FROM earnloop_game_rounds WHERE member_id=$1 AND day=(NOW() AT TIME ZONE 'UTC')::DATE FOR UPDATE",[m.id])).rows[0];
 if(answer===undefined){await c.query('COMMIT');const left=Math.floor(row.answer/2);return {question:`${left} + ${row.answer-left} = ?`,completed:row.completed,attempts_remaining:Math.max(0,3-row.attempts),xp:10};}
 if(!Number.isSafeInteger(answer))throw Error('Enter a whole-number answer');
 if(row.completed||row.attempts>=3)throw Error('Daily round finished; return tomorrow');
 const correct=answer===row.answer;
 await c.query('UPDATE earnloop_game_rounds SET attempts=attempts+1,completed=$2 WHERE id=$1',[row.id,correct]);
 if(correct){await c.query('UPDATE earnloop_members SET xp=xp+10 WHERE id=$1',[m.id]);await activity(c,m.id,'puzzle_completed','puzzle:'+String(row.day),{xp:10});}
 await c.query('COMMIT');return {correct,xp:correct?10:0,attempts_remaining:2-row.attempts};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function growthMetrics(pool){return (await pool.query(`SELECT kind,COUNT(*)::int events,COUNT(DISTINCT member_id)::int members FROM earnloop_activity GROUP BY kind ORDER BY kind`)).rows;}

/**
 * D1/D7/D30 retention by UTC signup calendar day.
 * Denominators include ONLY cohorts old enough to have reached the day.
 * Actions are authenticated check-ins, puzzles, or initiated offer sessions;
 * "returned" is a member session, NOT a verified unique human or cash earner.
 */
export async function retentionMetrics(pool) {
 const windows=[1,7,30];
 const clauses=windows.map(day=>{
  const signup="(m.created_at AT TIME ZONE 'UTC')::date";
  const cutoff="(NOW() AT TIME ZONE 'UTC')::date - "+day;
  return `COUNT(*) FILTER (WHERE ${signup} <= ${cutoff})::int AS eligible_d${day},
   COUNT(*) FILTER (
    WHERE ${signup} <= ${cutoff} AND EXISTS (
      SELECT 1 FROM earnloop_activity a
      WHERE a.member_id=m.id
        AND a.kind IN ('daily_checkin','puzzle_completed','offer_started')
        AND (a.created_at AT TIME ZONE 'UTC')::date = ${signup} + ${day}
    )
   )::int AS returned_d${day}`;
 });
 const result=await pool.query('SELECT '+clauses.join(', ')+' FROM earnloop_members m');
 const data=result.rows[0]||{};
 const output={};
 for(const day of windows){
  const eligible=Number(data['eligible_d'+day])||0;
  const returned=Number(data['returned_d'+day])||0;
  output['d'+day]={eligible,returned,
   rate:eligible?Number((returned/eligible).toFixed(4)):null};
 }
 return {schema:'earnloop.retention-cohorts.v1',timezone:'UTC',windows:output,
  activity_definition:'at least one saved check-in, completed daily puzzle or offer start on the exact UTC calendar day after signup',
  denominator_definition:'only members whose signup UTC date is at least N calendar days old',
  unique_humans_verified:false,paid_user_retention_verified:false,
  synthetic_users_excluded:false,
  caveat:'Session accounts may include test or duplicate people; manual activity and cash status are not independently verified.'};
}
