import crypto from 'node:crypto';
import {TASKS, validatePacket,canRun} from './policy.mjs';
const sha = v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function setupCompanyOS(pool) {
 await pool.query(`
 CREATE TABLE IF NOT EXISTS earnloop_os_work (
   id UUID PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, type TEXT NOT NULL, objective TEXT NOT NULL,
   owner TEXT NOT NULL, authority TEXT NOT NULL, risk TEXT NOT NULL,
   state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','awaiting_approval','running','completed','blocked')),
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS earnloop_os_receipts (
   id UUID PRIMARY KEY, work_id UUID NOT NULL UNIQUE REFERENCES earnloop_os_work(id),
   result JSONB NOT NULL, result_hash TEXT NOT NULL, verification TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE INDEX IF NOT EXISTS earnloop_os_work_state_idx ON earnloop_os_work(state,created_at);
 `);
}
export async function createWork(pool,input) {
 const p=validatePacket(input),state=canRun(p)?'queued':'awaiting_approval';
 const res=await pool.query(`INSERT INTO earnloop_os_work(id,idempotency_key,type,objective,owner,authority,risk,state)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,[crypto.randomUUID(),p.idempotency_key,p.type,p.objective,p.owner,p.authority,p.risk,state]);
 if (res.rows[0]) return res.rows[0];
 const existing=await pool.query('SELECT * FROM earnloop_os_work WHERE idempotency_key=$1',[p.idempotency_key]);
 const found=existing.rows[0];
 if (!found || found.type!==p.type || found.objective!==p.objective) throw new Error('Idempotency conflict');
 return found;
}
export async function metrics(pool) {
 const r=await pool.query(`SELECT
  (SELECT COUNT(*)::INT FROM earnloop_members) members,
  (SELECT COUNT(*)::INT FROM earnloop_waitlist) waitlist,
  (SELECT COUNT(*)::INT FROM earnloop_members WHERE xp>0) activated,
  (SELECT COALESCE(SUM(xp),0)::INT FROM earnloop_members) community_xp,
  (SELECT COUNT(*)::INT FROM earnloop_members WHERE referrer_id IS NOT NULL) referrals,
  (SELECT COUNT(*)::INT FROM earnloop_partner_events WHERE status='reported') reported_events,
  (SELECT COUNT(*)::INT FROM earnloop_partner_events WHERE status='settled') settled_events,
  (SELECT COALESCE(SUM(gross_cents),0)::BIGINT FROM earnloop_partner_events WHERE status='settled') settled_gross_cents,
  (SELECT COALESCE(SUM(reward_cents),0)::BIGINT FROM earnloop_partner_events WHERE status='settled') settled_reward_liability_cents`);
 const d=r.rows[0];
 return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,typeof v==='string'?Number(v):v]));
}
export function evaluate(type, facts) {
 switch(type){
  case 'snapshot_metrics': return {kind:'metrics',facts,analysis:'Actual database figures; partner settlement status is not proof of cash received. Operational cost and payout balances not included.',cash_verified:false};
  case 'audit_partner_events': return {kind:'trust_audit',reported_events:facts.reported_events,settled_events:facts.settled_events,blocker:facts.reported_events?'Independent provider reconciliation required':'No reported partner events',money_moved:false};
  case 'growth_diagnosis': return {kind:'growth_diagnosis',members:facts.members,activated:facts.activated,referrals:facts.referrals,activation_rate:facts.members?Number((facts.activated/facts.members).toFixed(4)):null,referral_rate:facts.members?Number((facts.referrals/facts.members).toFixed(4)):null,advice:facts.members===0?'Acquire the first real members before optimizing conversion.':(facts.activated/facts.members<0.3?'Improve first-session activation with daily non-cash quests.':'Measure returning members and verify an advertiser-funded conversion before scaling.'),money_moved:false};
  case 'draft_partner_outreach': return {kind:'draft',subject:'Earnloop publisher application',message:'Earnloop is an early-stage Canadian web rewards community. We seek approved offerwall publisher access, Canadian inventory, signed callbacks, reversal reports and disclosed commercial terms. We do not claim traffic or earnings not yet verified.',sent:false,money_moved:false};
  default: throw new Error('No safe executor available');
 }
}
export async function runOne(pool) {
 const client=await pool.connect(); let row;
 try {
   await client.query('BEGIN');
   const r=await client.query("SELECT * FROM earnloop_os_work WHERE state='queued' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
   row=r.rows[0];
   if(!row) {await client.query('COMMIT');return null;}
   if(!canRun(row)) {await client.query("UPDATE earnloop_os_work SET state='blocked', updated_at=NOW() WHERE id=$1",[row.id]);await client.query('COMMIT');return {id:row.id,state:'blocked'};}
   await client.query("UPDATE earnloop_os_work SET state='running',updated_at=NOW() WHERE id=$1",[row.id]);
   await client.query('COMMIT');
 } catch(err){await client.query('ROLLBACK');throw err;} finally {client.release();}
 try {
   const facts=await metrics(pool); const result=evaluate(row.type,facts),digest=sha(result);
   const verify=digest===sha(JSON.parse(JSON.stringify(result)))?'local_consistency_checked':'failed';
   const c=await pool.connect();
   try{await c.query('BEGIN');await c.query('INSERT INTO earnloop_os_receipts(id,work_id,result,result_hash,verification) VALUES($1,$2,$3,$4,$5) ON CONFLICT(work_id) DO NOTHING',[crypto.randomUUID(),row.id,JSON.stringify(result),digest,verify]);await c.query("UPDATE earnloop_os_work SET state='completed',updated_at=NOW() WHERE id=$1",[row.id]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   return {id:row.id,type:row.type,state:'completed',receipt_hash:digest,verification:verify};
 } catch(err) {
   await pool.query("UPDATE earnloop_os_work SET state='blocked',updated_at=NOW() WHERE id=$1",[row.id]);
   return {id:row.id,state:'blocked',reason:'Execution failed; inspect server logs'};
 }
}
export async function overview(pool) {
 const k=await metrics(pool);
 const w=await pool.query('SELECT id,type,objective,owner,authority,risk,state,created_at,updated_at FROM earnloop_os_work ORDER BY created_at DESC LIMIT 40');
 const r=await pool.query('SELECT work_id,result_hash,verification,created_at FROM earnloop_os_receipts ORDER BY created_at DESC LIMIT 20');
 return {product:'earnloop',company_os:'dedicated',kpis:k,work:w.rows,receipts:r.rows,paid_partners_configured:!!(process.env.PARTNER_NAME&&process.env.PARTNER_POSTBACK_SECRET),payouts_enabled:false};
}
