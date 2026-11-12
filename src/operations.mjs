import crypto from 'node:crypto';
import {toroxConfigured} from './torox.mjs';
import {evaluateRewardCreditReadiness} from './company-os/generated/feature_6b8888ce2d17.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK=/^https:\/\/[^\s<>]{5,1000}$/i;
const TRACKS={A:'Approved offerwall supply',B:'Sponsor-funded quests',C:'Attributed affiliate offers',D:'Merchant-credit experiments'};
const CHARGES=['provider_share','user_reward','referral','processing','fulfillment','acquisition','reversal','support'];
const valid=(s,min=1,max=180)=>typeof s==='string'&&s.trim().length>=min&&s.length<=max;
const cash=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const requiredLink=s=>{if(!LINK.test(s||''))throw Error('HTTPS source evidence required');return s.trim();};
const key=s=>{if(!/^[A-Za-z0-9_.:-]{1,140}$/.test(s||''))throw Error('Invalid external reference');return s;};
const uuid=s=>{if(!UUID.test(s||''))throw Error('Invalid identifier');return s;};
const allowed=(x,a)=>{if(!a.includes(x))throw Error('Unsupported state or type');return x;};
const event=async(pool,action,reference,details={})=>pool.query('INSERT INTO earnloop_ops_audit(id,action,reference,details) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),action,reference,JSON.stringify(details)]);

export async function setupOperations(pool){
 await pool.query("CREATE TABLE IF NOT EXISTS earnloop_ops_offers ("+
  "id UUID PRIMARY KEY,track TEXT NOT NULL CHECK(track IN ('A','B','C','D')),title TEXT NOT NULL,provider TEXT NOT NULL,"+
  "description TEXT NOT NULL,destination_url TEXT,source_reference TEXT NOT NULL,approval_reference TEXT,"+
  "state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','operator_published','paused')),"+
  "reward_currency TEXT,reward_minor INT CHECK(reward_minor>=0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_interactions ("+
  "id UUID PRIMARY KEY,offer_id UUID NOT NULL REFERENCES earnloop_ops_offers(id),member_id UUID NOT NULL REFERENCES earnloop_members(id),"+
  "event_type TEXT NOT NULL CHECK(event_type IN ('click','start')),idempotency_key TEXT NOT NULL,flag TEXT,"+
  "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,idempotency_key));"+
  "CREATE INDEX IF NOT EXISTS earnloop_ops_interactions_member_time ON earnloop_ops_interactions(member_id,created_at DESC);"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_redemptions ("+
  "id UUID PRIMARY KEY,member_id UUID NOT NULL REFERENCES earnloop_members(id),method TEXT NOT NULL,currency TEXT NOT NULL,"+
  "amount_minor INT NOT NULL CHECK(amount_minor>0),state TEXT NOT NULL DEFAULT 'interest_unfunded' "+
  "CHECK(state IN ('interest_unfunded','in_review','closed_unfunded')),"+
  "note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_evidence ("+
  "id UUID PRIMARY KEY,provider TEXT NOT NULL,event_id TEXT NOT NULL,kind TEXT NOT NULL,"+
  "source_url TEXT NOT NULL,classification TEXT NOT NULL DEFAULT 'operator_reported' CHECK(classification='operator_reported'),"+
  "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(provider,event_id,kind,source_url));"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_costs ("+
  "id UUID PRIMARY KEY,provider TEXT NOT NULL,event_id TEXT NOT NULL,kind TEXT NOT NULL,amount_minor INT NOT NULL CHECK(amount_minor>=0),"+
  "currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),source_url TEXT NOT NULL,"+
  "classification TEXT NOT NULL DEFAULT 'operator_reported' CHECK(classification='operator_reported'),"+
  "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(provider,event_id,kind));"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_experiments ("+
  "track TEXT PRIMARY KEY CHECK(track IN ('A','B','C','D')),objective TEXT NOT NULL,"+
  "state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','running','paused','completed')),"+
  "owner TEXT NOT NULL,source_url TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_provider_notes ("+
  "provider TEXT PRIMARY KEY,stage TEXT NOT NULL,source_url TEXT NOT NULL,notes TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE TABLE IF NOT EXISTS earnloop_ops_audit ("+
  "id UUID PRIMARY KEY,action TEXT NOT NULL,reference TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());");
 for(const [track,objective] of Object.entries(TRACKS)){
  await pool.query('INSERT INTO earnloop_ops_experiments(track,objective,owner) VALUES($1,$2,$3) ON CONFLICT(track) DO NOTHING',
  [track,objective,{A:'partnerships',B:'revenue',C:'growth',D:'partnerships'}[track]]);
 }
}

export function provisionalMargin(row,costs){
 const amount=row.gross_minor;
 const reportedReward=row.reward_minor;
 const values=Object.fromEntries(CHARGES.map(k=>[k,costs[k]?.currency===row.currency?costs[k].amount_minor:null]));
 if(reportedReward!=null && values.user_reward==null)values.user_reward=reportedReward;
 const complete=/^[A-Z]{3}$/.test(row.currency||'')&&Number.isSafeInteger(amount)&&Object.values(values).every(v=>Number.isSafeInteger(v)&&v>=0);
 return {revenue_minor:amount,reported_reward_minor:reportedReward,expenses:values,
  contribution_minor:complete?amount-Object.values(values).reduce((a,b)=>a+b,0):null,
  verified_contribution_minor:null,valuation:'source_report_only',missing_costs:CHARGES.filter(k=>values[k]==null)};
}

/** Show source-reported reward readiness from the original ledger projection.
 * No cash verification integration exists. Never let a reported postback,
 * operator evidence URL, or numeric margin grant payable rewards.
 */
export function sourceRewardCreditReadiness(transaction,env=process.env){
 const safeCents=value=>{
  if(typeof value==='number' && Number.isSafeInteger(value))return value;
  if(typeof value==='string' && /^(0|[1-9][0-9]*)$/.test(value) &&
     Number.isSafeInteger(Number(value)))return Number(value);
  return -1;
 };
 const expense=transaction?.economics?.expenses?.user_reward;
 const reward=expense ?? transaction?.reward_minor;
 const data={
  publisherApproved:transaction?.provider==='torox' && toroxConfigured(env),
  callbackVerified:false, // source postback != independent provider validation
  reversalPending:transaction?.reversed!==false,
  settledGrossCents:safeCents(transaction?.gross_minor),
  rewardLiabilityCents:safeCents(reward),
  cashIndependentlyVerified:false, // no reconciled bank/provider cash source
 };
 const verdict=evaluateRewardCreditReadiness(data);
 return {...verdict,
  evidence_state:'SOURCE_REPORTED_UNVERIFIED',
  observed_provider_callback:false,
  independently_collected_cash:false,
  payout_execution_enabled:false};
}

export async function getOperations(pool,env=process.env){
 const [members,offers,interactions,redemptions,evidence,costs,experiments,providerNotes,torox,legacy,support,sponsors,work,finance]=await Promise.all([
  pool.query("SELECT m.id,m.code,m.xp,m.created_at,m.last_checkin,COUNT(DISTINCT a.id)::int AS activity_events,"+
   "COUNT(DISTINCT a.id) FILTER(WHERE a.kind='daily_checkin')::int AS checkins FROM earnloop_members m "+
   "LEFT JOIN earnloop_activity a ON a.member_id=m.id GROUP BY m.id ORDER BY m.created_at DESC LIMIT 100"),
  pool.query('SELECT * FROM earnloop_ops_offers ORDER BY created_at DESC LIMIT 100'),
  pool.query('SELECT * FROM earnloop_ops_interactions ORDER BY created_at DESC LIMIT 100'),
  pool.query('SELECT r.*,m.code AS member_code FROM earnloop_ops_redemptions r JOIN earnloop_members m ON m.id=r.member_id ORDER BY r.created_at DESC LIMIT 100'),
  pool.query('SELECT * FROM earnloop_ops_evidence ORDER BY created_at DESC LIMIT 200'),
  pool.query('SELECT * FROM earnloop_ops_costs ORDER BY created_at DESC LIMIT 200'),
  pool.query('SELECT * FROM earnloop_ops_experiments ORDER BY track'),
  pool.query('SELECT * FROM earnloop_ops_provider_notes ORDER BY provider'),
  pool.query("SELECT provider,event_id,member_id,offer_id,status,reversal,received_at,publisher_payout_reported_usd,amount_units FROM earnloop_torox_postbacks ORDER BY received_at DESC LIMIT 100"),
  pool.query("SELECT provider,event_id,member_id,status,received_at,gross_cents,reward_cents FROM earnloop_partner_events ORDER BY received_at DESC LIMIT 100"),
  pool.query('SELECT id,subject,state,created_at FROM earnloop_support ORDER BY created_at DESC LIMIT 100'),
  pool.query('SELECT id,email,brief,state,created_at FROM earnloop_sponsor_leads ORDER BY created_at DESC LIMIT 100'),
  pool.query('SELECT id,type,owner,authority,state,created_at FROM earnloop_os_work ORDER BY created_at DESC LIMIT 50'),
  pool.query('SELECT provider,external_id,kind,currency,amount_minor,classification,evidence_reference FROM earnloop_financial_journal ORDER BY created_at DESC LIMIT 150')
 ]);
 const cMap=new Map();
 for(const r of costs.rows){const index=r.provider+':'+r.event_id;const v=cMap.get(index)||{};v[r.kind]={amount_minor:Number(r.amount_minor),currency:r.currency};cMap.set(index,v);}
 const transactions=[
 ...torox.rows.map(r=>({provider:'torox',event_id:r.event_id,member_id:r.member_id,offer_id:r.offer_id,
  source_state:r.status,reversed:!!r.reversal,currency:'USD',gross_minor:Math.round(Number(r.publisher_payout_reported_usd)*100),
  gross_meaning:'provider-reported publisher payout, not advertiser gross',reward_minor:null,received_at:r.received_at})),
 ...legacy.rows.map(r=>({provider:r.provider,event_id:r.event_id,member_id:r.member_id,offer_id:null,source_state:r.status,
  reversed:r.status==='reversed',currency:null,gross_minor:r.gross_cents,reward_minor:r.reward_cents,
  gross_meaning:'partner-reported gross; currency unverified',received_at:r.received_at}))
 ].map(r=>({...r,economics:provisionalMargin(r,cMap.get(r.provider+':'+r.event_id)||{}),
   evidence:evidence.rows.filter(e=>e.provider===r.provider&&e.event_id===r.event_id),
   cash_verified:false,payout_verified:false,fulfillment_verified:false,proof:'unverified'}))
 .map(r=>({...r,reward_credit_readiness:sourceRewardCreditReadiness(r,env)}))
 .sort((a,b)=>Date.parse(b.received_at)-Date.parse(a.received_at)).slice(0,150);
 const m=members.rows.map(r=>({...r,qualification:r.checkins>=1?'activity_qualified':'signup_only',verified_identity:false}));
 const providers=['torox','bitlabs','ayet','tremendous'].map(p=>{
  const note=providerNotes.rows.find(x=>x.provider===p);
  return {name:p,technical_status:p==='torox'&&toroxConfigured(env)?'configured':'not_configured',
   onboarding_status:note?.stage||'not_recorded',approval_reported_reference:note?.source_url||null,
   actual_approved: p==='torox'&&toroxConfigured(env),notes:note?.notes||null};
 });
 const risk=interactions.rows.filter(x=>x.flag);
 const rewardLedger=[
  ...torox.rows.map(r=>({provider:'torox',event_id:r.event_id,member_id:r.member_id,kind:r.reversal?'source_reversal':'provider_reported_units',
   amount:String(r.amount_units),currency:'PROVIDER_UNITS',classification:'source_reported_unfunded',available:false,created_at:r.received_at})),
  ...legacy.rows.map(r=>({provider:r.provider,event_id:r.event_id,member_id:r.member_id,kind:r.status==='reversed'?'source_reversal':'provider_reported_reward',
   amount:String(r.reward_cents),currency:'UNVERIFIED_MINOR_UNITS',classification:'source_reported_unfunded',available:false,created_at:r.received_at})),
  ...finance.rows.filter(r=>['reward_liability','reward_reservation','fulfillment','refund'].includes(r.kind))
   .map(r=>({provider:r.provider,event_id:r.external_id,member_id:null,kind:r.kind,amount:String(r.amount_minor),
    currency:r.currency,classification:r.classification,available:false,created_at:null}))
 ];
 const signedCash=0; // No independent bank reconciliation endpoint exists in this release.
 return {product:'earnloop',evidence_policy:'manual entries are operator-reported; never externally verified',
  integration:'existing_company_os',providers,members:m,offers:offers.rows,interactions:interactions.rows,
  transactions,redemptions:redemptions.rows,evidence:evidence.rows,costs:costs.rows,
  experiments:experiments.rows,support:support.rows,sponsor_leads:sponsors.rows,work:work.rows,finance:finance.rows,
  risk_flags:risk,reward_ledger:rewardLedger,first_profit:{verified_collected_cash_minor:null,verified_positive_margin_transactions:signedCash,
   verified_redemptions:0,proof_achieved:false,reason:'Independent provider settlement, bank receipt, complete actual costs and fulfillment reconciliation required'},
  counts:{members:m.length,qualifying_activity:m.filter(x=>x.qualification==='activity_qualified').length,
   verified_members:0,source_reported_transactions:transactions.length,verified_transactions:0,
   reported_reversals:transactions.filter(x=>x.reversed).length,reported_failures:evidence.rows.filter(x=>x.kind==='failure').length,redemption_requests:redemptions.rowCount,verified_payouts:0,
   flagged_interactions:risk.length,offers_published:offers.rows.filter(x=>x.state==='operator_published').length},
  payout_execution_enabled:false};
}

export async function memberOffers(pool){
 const offers=(await pool.query("SELECT id,track,title,provider,description,destination_url,source_reference,reward_currency,reward_minor "+
 "FROM earnloop_ops_offers WHERE state='operator_published' AND destination_url IS NOT NULL AND approval_reference IS NOT NULL ORDER BY created_at DESC LIMIT 50")).rows;
 return {offers,torox_session_available:toroxConfigured(),cash_payouts_enabled:false,
   disclosure:'Listings are operator-published. Reward redemption requires separately confirmed funding; XP is not cash.'};
}
export async function trackMember(pool,memberId,body){
 const offerId=uuid(body.offer_id),kind=allowed(body.event_type,['click','start']);
 const eventKey=key(body.idempotency_key);
 const offer=(await pool.query("SELECT id,destination_url FROM earnloop_ops_offers WHERE id=$1 AND state='operator_published' AND approval_reference IS NOT NULL",[offerId])).rows[0];
 if(!offer)throw Error('Offer not available');
 const recent=(await pool.query("SELECT COUNT(*)::int n FROM earnloop_ops_interactions WHERE member_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",[memberId])).rows[0].n;
 const flag=recent>=20?'velocity_review':null;
 const r=await pool.query("INSERT INTO earnloop_ops_interactions(id,offer_id,member_id,event_type,idempotency_key,flag) "+
 "VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(member_id,idempotency_key) DO NOTHING RETURNING id,flag",[crypto.randomUUID(),offerId,memberId,kind,eventKey,flag]);
 if(!r.rowCount){
  const prior=(await pool.query("SELECT id,offer_id,event_type,flag FROM earnloop_ops_interactions WHERE member_id=$1 AND idempotency_key=$2",[memberId,eventKey])).rows[0];
  if(prior.offer_id!==offerId||prior.event_type!==kind)throw Error('Interaction idempotency conflict');
  return {recorded:false,interaction_id:prior.id,flag:prior.flag,destination_url:offer.destination_url,cash_awarded:false};
 }
 return {recorded:true,interaction_id:r.rows[0].id,flag,destination_url:offer.destination_url,cash_awarded:false};
}
export async function requestRedemption(pool,memberId,input){
 const method=allowed(input.method,['gift_card','bank','other']);
 const currency=allowed(input.currency,['CAD','USD']);
 if(!cash(input.amount_minor)||input.amount_minor===0||input.acknowledge_unfunded!==true)throw Error('Valid amount and acknowledgment required');
 const n=(await pool.query("SELECT COUNT(*)::int n FROM earnloop_ops_redemptions WHERE member_id=$1 AND state IN ('interest_unfunded','in_review')",[memberId])).rows[0].n;
 if(n>=3)throw Error('Only three open funding-interest requests allowed');
 const id=crypto.randomUUID();
 await pool.query("INSERT INTO earnloop_ops_redemptions(id,member_id,method,currency,amount_minor,note) VALUES($1,$2,$3,$4,$5,$6)",
  [id,memberId,method,currency,input.amount_minor,String(input.note||'').slice(0,300)]);
 return {id,state:'interest_unfunded',cash_payable:false,fulfillment_promised:false};
}
export async function memberRedemptions(pool,memberId){
 return {requests:(await pool.query('SELECT id,method,currency,amount_minor,state,created_at FROM earnloop_ops_redemptions WHERE member_id=$1 ORDER BY created_at DESC LIMIT 20',[memberId])).rows,
  payable_balance_minor:0,payouts_enabled:false};
}

export async function operate(pool,input){
 const action=allowed(input.action,['offer_create','offer_state','provider_note','experiment','evidence','cost',
  'support_state','sponsor_state','redemption_state']);
 if(action==='offer_create'){
  const track=allowed(input.track,Object.keys(TRACKS));
  if(!valid(input.title,5,120)||!valid(input.provider,2,70)||!valid(input.description,20,600))throw Error('Title, provider, description required');
  const source=requiredLink(input.source_reference);
  const destination=input.destination_url?requiredLink(input.destination_url):null;
  if(input.reward_minor!=null&&(!cash(input.reward_minor)||!['CAD','USD'].includes(input.reward_currency)))throw Error('Invalid reward units');
  const id=crypto.randomUUID();
  await pool.query("INSERT INTO earnloop_ops_offers(id,track,title,provider,description,destination_url,source_reference,reward_currency,reward_minor) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[id,track,input.title.trim(),input.provider.trim(),input.description.trim(),
    destination,source,input.reward_minor==null?null:input.reward_currency,input.reward_minor??null]);
  await event(pool,action,id,{track});return {id,state:'draft',verified_inventory:false};
 }
 if(action==='offer_state'){
  const id=uuid(input.id),state=allowed(input.state,['draft','operator_published','paused']);
  const approval=input.approval_reference?requiredLink(input.approval_reference):null;
  const r=await pool.query("UPDATE earnloop_ops_offers SET state=$2,approval_reference=COALESCE($3,approval_reference),updated_at=NOW() "+
   "WHERE id=$1 AND ($2!='operator_published' OR (destination_url IS NOT NULL AND COALESCE($3,approval_reference) IS NOT NULL)) RETURNING id,state",[id,state,approval]);
  if(!r.rowCount)throw Error('Offer missing or real approval evidence/link required');
  await event(pool,action,id,{state});return {...r.rows[0],classification:'operator_reported'};
 }
 if(action==='provider_note'){
  const provider=allowed(input.provider,['torox','bitlabs','ayet','tremendous']);
  const stage=allowed(input.stage,['not_started','applied','response_received','contract_reported','blocked']);
  if(!valid(input.notes,5,600))throw Error('Detailed note required');
  await pool.query("INSERT INTO earnloop_ops_provider_notes(provider,stage,source_url,notes) VALUES($1,$2,$3,$4) "+
   "ON CONFLICT(provider) DO UPDATE SET stage=EXCLUDED.stage,source_url=EXCLUDED.source_url,notes=EXCLUDED.notes,updated_at=NOW()",
   [provider,stage,requiredLink(input.source_url),input.notes.trim()]);
  await event(pool,action,provider,{stage});return {provider,stage,technical_connection_unchanged:true};
 }
 if(action==='experiment'){
  const track=allowed(input.track,Object.keys(TRACKS)),state=allowed(input.state,['planned','running','paused','completed']);
  const r=await pool.query("UPDATE earnloop_ops_experiments SET state=$2,source_url=COALESCE($3,source_url),updated_at=NOW() "+
  "WHERE track=$1 RETURNING *",[track,state,input.source_url?requiredLink(input.source_url):null]);
  await event(pool,action,track,{state});return r.rows[0];
 }
 if(action==='evidence'){
  const provider=key(input.provider),external=key(input.event_id),kind=allowed(input.kind,
   ['provider_report','approval','reversal','remittance','bank_receipt','fulfillment','dispute','failure','other']);
  const id=crypto.randomUUID();
  const r=await pool.query("INSERT INTO earnloop_ops_evidence(id,provider,event_id,kind,source_url) VALUES($1,$2,$3,$4,$5) "+
   "ON CONFLICT(provider,event_id,kind,source_url) DO NOTHING RETURNING id",[id,provider,external,kind,requiredLink(input.source_url)]);
  await event(pool,action,provider+':'+external,{kind,recorded:!!r.rowCount});
  return {recorded:!!r.rowCount,classification:'operator_reported',cash_verified:false};
 }
 if(action==='cost'){
  const provider=key(input.provider),external=key(input.event_id),kind=allowed(input.kind,CHARGES);
  if(!cash(input.amount_minor))throw Error('Valid cost in currency minor units required');
  const currency=allowed(input.currency,['CAD','USD']);
  const r=await pool.query("INSERT INTO earnloop_ops_costs(id,provider,event_id,kind,amount_minor,currency,source_url) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,event_id,kind) DO NOTHING RETURNING id",
   [crypto.randomUUID(),provider,external,kind,input.amount_minor,currency,requiredLink(input.source_url)]);
  if(!r.rowCount)throw Error('Cost already recorded; reconcile conflicts independently');
  await event(pool,action,provider+':'+external,{kind});return {recorded:true,classification:'operator_reported'};
 }
 if(action==='support_state'||action==='sponsor_state'){
  const id=uuid(input.id),state=allowed(input.state,['open','in_review','resolved','new','contacted','closed']);
  const table=action==='support_state'?'earnloop_support':'earnloop_sponsor_leads';
  const r=await pool.query('UPDATE '+table+' SET state=$2 WHERE id=$1 RETURNING id,state',[id,state]);
  if(!r.rowCount)throw Error('Record not found');
  await event(pool,action,id,{state});return r.rows[0];
 }
 const id=uuid(input.id),state=allowed(input.state,['interest_unfunded','in_review','closed_unfunded']);
 const r=await pool.query("UPDATE earnloop_ops_redemptions SET state=$2,updated_at=NOW() WHERE id=$1 RETURNING id,state",[id,state]);
 if(!r.rowCount)throw Error('Request not found');
 await event(pool,action,id,{state});return {...r.rows[0],paid:false};
}
