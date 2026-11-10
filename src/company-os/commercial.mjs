/**
 * Earnloop commercial outbox. Reuses the product PostgreSQL and existing tick.
 * Portal visits are not submissions; provider message ID is needed to claim API acceptance.
 * Operator-reported evidence is explicitly not third-party verification.
 */
import crypto from 'node:crypto';

export const COMMERCIAL_TARGETS=Object.freeze([
 {key:'torox_publisher',partner:'Torox',channel:'portal',portal_url:'https://torox.io/register/',to_email:null,
  subject:'Earnloop publisher application',
  message:'Apply as a publisher for https://earnloop-web-production.up.railway.app/. Declare actual current daily users and revenue, not projected figures. Request Canadian incentivized web eligibility, approved placements, callback and reversal rules, payout minimum and settlement terms.'},
 {key:'ayet_publisher',partner:'ayeT Studios',channel:'email',portal_url:'https://www.ayetstudios.com/account/login/register-publisher',
  to_email:'support@ayetstudios.com',
  subject:'Earnloop — Canadian web publisher eligibility',
  message:'Hello ayeT team,\n\nI represent Earnloop, an early-stage Canadian web rewards community operated by Noetfield Systems Inc. We would like to confirm eligibility for a permissioned incentivized-offer integration. Could you advise the publisher approval path, qualifying Canadian web inventory, traffic-quality requirements, authenticated postback and reversal specs, payout minimum, settlement cadence and any minimum traffic? We will disclose our actual traffic during onboarding and will not show paid offers or promise funded rewards before approval.\n\nProduct: https://earnloop-web-production.up.railway.app/\nCompany: Noetfield Systems Inc.\n\nThank you,\nEarnloop partnerships'},
 {key:'first_sponsor',partner:'First paid quest sponsor',channel:'email',portal_url:null,to_email:null,
  subject:'Measured community quest — Earnloop sponsor pilot',
  message:'Hello,\n\nEarnloop is exploring a small, consent-based sponsor-funded community quest. We propose clearly disclosed deliverables, verified attribution, agreed reporting, a defined fixed fee and no speculative audience claims. Would you be open to discussing a pilot?\n\nEarnloop partnerships'}
]);
const KEY=/^[a-z][a-z0-9_]{4,50}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function fingerprint(x){return crypto.createHash('sha256').update(JSON.stringify([x.to_email,x.subject,x.message])).digest('hex');}
export function validEmail(v){return typeof v==='string'&&v.length<=254&&EMAIL.test(v);}
export function configuredForDispatch(env,to){
 const allow=String(env.OUTREACH_ALLOWED_RECIPIENTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return Boolean(typeof env.RESEND_API_KEY==='string' && env.RESEND_API_KEY.length>=20
 && validEmail(env.OUTREACH_FROM) && validEmail(to) && allow.includes(to.toLowerCase()));
}
export async function submitEmail(target,{env=process.env,fetcher=fetch}={}){
 if(!configuredForDispatch(env,target.to_email))throw new Error('OUTBOUND_NOT_CONFIGURED_OR_RECIPIENT_NOT_ALLOWED');
 if(target.channel!=='email'||!KEY.test(target.key)||!target.id||!target.subject||!target.message)throw new Error('INVALID_APPROVED_EMAIL');
 const response=await fetcher('https://api.resend.com/emails',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
   'Idempotency-Key':'earnloop/'+target.id},
  body:JSON.stringify({from:env.OUTREACH_FROM,to:[target.to_email],subject:target.subject,text:target.message})
 });
 if(!response.ok)throw new Error('EMAIL_PROVIDER_REJECTED_'+response.status);
 const payload=await response.json();
 if(typeof payload?.id!=='string'||payload.id.length<8||payload.id.length>128)throw new Error('EMAIL_PROVIDER_DID_NOT_CONFIRM_MESSAGE_ID');
 return payload.id;
}
export async function setupCommercial(pool){
 await pool.query("CREATE TABLE IF NOT EXISTS earnloop_os_commercial ("+
  "id UUID PRIMARY KEY, key TEXT NOT NULL UNIQUE, partner TEXT NOT NULL,"+
  "channel TEXT NOT NULL CHECK(channel IN ('portal','email')),portal_url TEXT,to_email TEXT,"+
  "subject TEXT NOT NULL,message TEXT NOT NULL,"+
  "state TEXT NOT NULL DEFAULT 'prepared' CHECK(state IN ("+
  "'prepared','approved','sending','sent','delivery_unknown','submitted_reported','replied_reported','rejected_reported')),"+
  "approval_fingerprint TEXT,approved_at TIMESTAMPTZ,dispatch_id TEXT,follow_up_at TIMESTAMPTZ,last_error TEXT,"+
  "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE TABLE IF NOT EXISTS earnloop_os_commercial_events ("+
  "id BIGSERIAL PRIMARY KEY,target_id UUID NOT NULL REFERENCES earnloop_os_commercial(id),"+
  "kind TEXT NOT NULL,evidence_reference TEXT NOT NULL,actor TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
  "CREATE INDEX IF NOT EXISTS earnloop_os_commercial_due_idx ON earnloop_os_commercial(state,follow_up_at);");
 for(const t of COMMERCIAL_TARGETS){
  await pool.query("INSERT INTO earnloop_os_commercial(id,key,partner,channel,portal_url,to_email,subject,message) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(key) DO NOTHING",
   [crypto.randomUUID(),t.key,t.partner,t.channel,t.portal_url,t.to_email,t.subject,t.message]);
 }
}
export async function listCommercial(pool,env=process.env){
 const r=await pool.query("SELECT id,key,partner,channel,portal_url,to_email,subject,message,state,"+
  "approved_at,dispatch_id,follow_up_at,last_error,updated_at,"+
  "(follow_up_at IS NOT NULL AND follow_up_at<=NOW() AND state='sent') AS follow_up_due "+
  "FROM earnloop_os_commercial ORDER BY CASE key WHEN 'torox_publisher' THEN 0 WHEN 'ayet_publisher' THEN 1 ELSE 2 END,key");
 return {targets:r.rows.map(x=>({...x,can_send:x.state==='approved'&&configuredForDispatch(env,x.to_email)})),
  send_ready:validEmail(env.OUTREACH_FROM)&&Boolean(env.RESEND_API_KEY),
  founder_approval_token_configured:typeof env.COMMERCIAL_FOUNDER_APPROVAL_TOKEN==='string'&&env.COMMERCIAL_FOUNDER_APPROVAL_TOKEN.length>=32,
  meaning:'sent means provider API accepted with ID; submitted/replied mean operator-reported; none prove publisher acceptance, fulfillment or collected cash'};
}
export async function configureContact(pool,key,email,source){
 if(!KEY.test(key)||!validEmail(email)||typeof source!=='string'||source.length<12||
 source.length>500||!/^https:\/\/[^\s]+$/i.test(source))throw new Error('VALID_KEY_CONTACT_AND_HTTPS_SOURCE_REQUIRED');
 const r=await pool.query("UPDATE earnloop_os_commercial SET to_email=$2,"+
  "state='prepared',approval_fingerprint=NULL,approved_at=NULL,updated_at=NOW() "+
  "WHERE key=$1 AND channel='email' AND state='prepared' RETURNING id,key,to_email",[key,email.toLowerCase()]);
 if(!r.rows[0])throw new Error('UNKNOWN_TARGET_OR_ALREADY_APPROVED');
 await pool.query("INSERT INTO earnloop_os_commercial_events(target_id,kind,evidence_reference,actor) "+
  "VALUES($1,'contact_source',$2,'operator_reported')",[r.rows[0].id,source]);
 return r.rows[0];
}
export async function approveCommercial(pool,key){
 if(!KEY.test(key))throw new Error('INVALID_TARGET');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const r=await c.query('SELECT * FROM earnloop_os_commercial WHERE key=$1 FOR UPDATE',[key]);
  const target=r.rows[0];
  if(!target||target.channel!=='email'||target.state!=='prepared'||!validEmail(target.to_email))
   throw new Error('TARGET_NOT_READY_FOR_FOUNDER_APPROVAL');
  const u=await c.query("UPDATE earnloop_os_commercial SET state='approved',approval_fingerprint=$2,"+
   "approved_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING key,state,to_email",[target.id,fingerprint(target)]);
  await c.query('COMMIT');return u.rows[0];
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function dispatchCommercial(pool,key,options={}){
 const env=options.env||process.env;
 if(!KEY.test(key))throw new Error('INVALID_TARGET');
 const r=await pool.query('SELECT * FROM earnloop_os_commercial WHERE key=$1',[key]);
 const target=r.rows[0];
 if(!target||target.state!=='approved'||target.approval_fingerprint!==fingerprint(target))
  throw new Error('APPROVED_UNMODIFIED_TARGET_REQUIRED');
 if(!configuredForDispatch(env,target.to_email))throw new Error('EMAIL_SENDER_OR_ALLOWLIST_NOT_CONFIGURED');
 const claim=await pool.query("UPDATE earnloop_os_commercial SET state='sending',updated_at=NOW() "+
  "WHERE id=$1 AND state='approved' AND approval_fingerprint=$2 RETURNING id,key,to_email,subject,message,channel",
  [target.id,target.approval_fingerprint]);
 if(!claim.rows[0])throw new Error('ALREADY_CLAIMED');
 try{
  const id=await submitEmail(claim.rows[0],options);
  await pool.query("UPDATE earnloop_os_commercial SET state='sent',dispatch_id=$2,"+
   "follow_up_at=NOW()+INTERVAL '7 days',last_error=NULL,updated_at=NOW() "+
   "WHERE id=$1 AND state='sending'",[target.id,id]);
  await pool.query("INSERT INTO earnloop_os_commercial_events(target_id,kind,evidence_reference,actor) "+
   "VALUES($1,'api_accepted',$2,'resend_api')",[target.id,id]);
  return {key,state:'sent',provider_message_id:id,accepted_by:'resend_api',delivered:false};
 }catch(err){
  // Timeouts can happen after acceptance; never blindly retry an ambiguous send.
  await pool.query("UPDATE earnloop_os_commercial SET state='delivery_unknown',last_error=$2,updated_at=NOW() "+
   "WHERE id=$1 AND state='sending'",[target.id,String(err.message||'unknown').slice(0,140)]);
  throw err;
 }
}
export async function recordCommercialEvidence(pool,key,kind,reference){
 if(!KEY.test(key)||!['submitted','replied','rejected'].includes(kind)||
  typeof reference!=='string'||reference.trim().length<8||reference.length>500)
  throw new Error('VALID_TARGET_EVENT_AND_EVIDENCE_REFERENCE_REQUIRED');
 const state={submitted:'submitted_reported',replied:'replied_reported',rejected:'rejected_reported'}[kind];
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const r=await c.query("UPDATE earnloop_os_commercial SET state=$2,updated_at=NOW() "+
   "WHERE key=$1 AND state NOT IN ('sending','delivery_unknown','rejected_reported') "+
   "AND NOT (channel='email' AND $2='submitted_reported' AND state!='sent') RETURNING id,key,state",[key,state]);
  if(!r.rows[0])throw new Error('EVENT_NOT_ALLOWED_FOR_CURRENT_STATE');
  await c.query("INSERT INTO earnloop_os_commercial_events(target_id,kind,evidence_reference,actor) "+
   "VALUES($1,$2,$3,'operator_reported')",[r.rows[0].id,kind,reference.trim()]);
  await c.query('COMMIT');return {...r.rows[0],verified_by_partner:false};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
