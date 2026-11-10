import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {setupCompanyOS,createWork,runOne,overview,metrics} from './company-os/engine.mjs';
import {ROLES,TASKS} from './company-os/policy.mjs';
import {toroxConfigured,createToroxWallSession,parseToroxPostback} from './torox.mjs';

const PORT=Number(process.env.PORT||3000);
if(!process.env.DATABASE_URL) throw Error('DATABASE_URL required: refusing ephemeral member storage');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const random=n=>crypto.randomBytes(n).toString('hex');
const limits=new Map();
const headers={
 'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
 'x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()',
 'cache-control':'no-store',
 'content-security-policy':"default-src 'self'; img-src 'self' data:; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function send(res,status,body,type='application/json; charset=utf-8',extra={}) {res.writeHead(status,{'content-type':type,...headers,...extra});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));}
function fail(res,status,msg) {return send(res,status,{error:msg});}
function admin(req){
 const key=process.env.COMPANY_OS_ADMIN_TOKEN;
 if(!key || key.length<32) return false;
 const provided=String(req.headers.authorization||'').replace(/^Bearer /i,'');
 if(!provided) return false;
 const a=crypto.createHash('sha256').update(provided).digest(),b=crypto.createHash('sha256').update(key).digest();
 return crypto.timingSafeEqual(a,b);
}
function cookie(req){const m=/(?:^|;\s*)el_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');return m?.[1]||null;}
function rate(req,max=25){
 const ip=String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 const key=sha(ip).slice(0,20), now=Date.now(), prev=limits.get(key);
 if(limits.size>25000) limits.clear();
 if(!prev||now-prev.start>900000){limits.set(key,{start:now,count:1});return true;}
 return ++prev.count<=max;
}
async function body(req,max=12000){
 if(!String(req.headers['content-type']||'').startsWith('application/json')) throw Object.assign(Error('JSON required'),{status:415});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>max)throw Object.assign(Error('Request too large'),{status:413});}
 try {return {value:JSON.parse(raw||'{}'),raw};}catch{throw Object.assign(Error('Malformed JSON'),{status:400});}
}
async function member(req){const token=cookie(req);if(!token)return null;const r=await pool.query('SELECT id,code,xp,last_checkin,created_at FROM earnloop_members WHERE token_hash=$1',[sha(token)]);return r.rows[0]||null;}
async function init(){
 await pool.query(`CREATE TABLE IF NOT EXISTS earnloop_members(
   id UUID PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,code TEXT NOT NULL UNIQUE,
   referrer_id UUID REFERENCES earnloop_members(id) ON DELETE SET NULL,
   xp INT NOT NULL DEFAULT 0 CHECK(xp>=0),last_checkin DATE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS earnloop_waitlist(id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE,
   member_id UUID REFERENCES earnloop_members(id) ON DELETE CASCADE,
   consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS earnloop_partner_events(
   id BIGSERIAL PRIMARY KEY,provider TEXT NOT NULL,event_id TEXT NOT NULL,member_id UUID NOT NULL REFERENCES earnloop_members(id),
   gross_cents INT NOT NULL CHECK(gross_cents>=0),reward_cents INT NOT NULL CHECK(reward_cents>=0),
   status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','reversed','settled')),
   received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(provider,event_id));
 CREATE TABLE IF NOT EXISTS earnloop_torox_postbacks(
   provider TEXT NOT NULL DEFAULT 'torox',event_id TEXT NOT NULL,
   member_id UUID NOT NULL REFERENCES earnloop_members(id),offer_id TEXT NOT NULL,
   amount_units NUMERIC(18,8) NOT NULL,publisher_payout_reported_usd NUMERIC(18,8) NOT NULL,
   reversal BOOLEAN NOT NULL DEFAULT FALSE,
   status TEXT NOT NULL DEFAULT 'reported_unsettled' CHECK(status IN ('reported_unsettled','reversal_reported','reviewed')),
   received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   PRIMARY KEY(provider,event_id));
 CREATE INDEX IF NOT EXISTS earnloop_referrers_idx ON earnloop_members(referrer_id);`);
 await setupCompanyOS(pool);
}
async function server(req,res){
 const url=new URL(req.url||'/', 'https://localhost');const route=url.pathname,method=req.method||'GET';
 if(method==='GET'&&route==='/health'){
  try{await pool.query('SELECT 1');return send(res,200,{ok:true,database:'connected',product:'earnloop',company_os:'dedicated',cash_payouts_enabled:false});}
  catch{return fail(res,503,'Database unavailable');}
 }
 const files={'/':'index.html','/privacy':'privacy.html','/terms':'terms.html','/company-os':'company-os.html','/style.css':'style.css','/app.js':'app.js','/company-os.js':'company-os.js'};
 if(method==='GET'&&Object.hasOwn(files,route)){
  const file=files[route],type=file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8';
  const raw=await fs.readFile(path.join(root,'public',file));return send(res,200,raw,type);
 }
 if(method==='GET'&&route==='/api/offerwall/status')
  return send(res,200,{provider:'torox',enabled:toroxConfigured(),
   status:toroxConfigured()?'PUBLISHER_APPROVED_SESSION_AVAILABLE':'PUBLISHER_APPROVAL_REQUIRED',
   payouts_enabled:false,source_reports_are_collected_revenue:false});
 if(method==='GET'&&route==='/api/offerwall/session'){
  if(!toroxConfigured())return fail(res,503,'Publisher approval pending');
  if(!rate(req,10))return fail(res,429,'Rate limit exceeded');
  const m=await member(req);if(!m)return fail(res,401,'Join first');
  try{const wall_url=await createToroxWallSession(m.id);
    return send(res,200,{wall_url,provider:'torox',payouts_enabled:false});}
  catch{return fail(res,502,'Partner session temporarily unavailable');}
 }
 if(method==='GET'&&route==='/api/partner/torox/postback'){
  if(!toroxConfigured())return send(res,503,'0','text/plain; charset=utf-8');
  try{
   const e=parseToroxPostback(url);
   await pool.query(
    'INSERT INTO earnloop_torox_postbacks(event_id,member_id,offer_id,amount_units,publisher_payout_reported_usd,reversal,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,event_id) DO NOTHING',
    [e.eventId,e.memberId,e.offerId,e.amountUnits,e.publisherPayoutReported,
     e.reversal,e.reversal?'reversal_reported':'reported_unsettled']);
   // Provider requires "1"; no source callback creates cash or user withdrawal credit.
   return send(res,200,'1','text/plain; charset=utf-8');
  }catch{return send(res,400,'0','text/plain; charset=utf-8');}
 }
 if(method==='GET'&&route==='/api/stats'){
  const m=await metrics(pool);return send(res,200,{members:m.members,early_access:m.waitlist,community_xp:m.community_xp,settled_events:m.settled_events,offerwall_status:toroxConfigured()?'publisher_approved':'publisher_pending',cash_payouts_enabled:false});
 }
 if(method==='GET'&&route==='/api/leaderboard'){
  const r=await pool.query('SELECT code,xp FROM earnloop_members WHERE xp>0 ORDER BY xp DESC,created_at ASC LIMIT 10');
  return send(res,200,{leaders:r.rows.map(x=>({name:'Explorer '+x.code.slice(-4).toUpperCase(),xp:x.xp}))});
 }
 if(method==='GET'&&route==='/api/me'){
  const m=await member(req);if(!m)return send(res,200,{member:null});
  const rr=await pool.query('SELECT COUNT(*)::INT n FROM earnloop_members WHERE referrer_id=$1',[m.id]);
  return send(res,200,{member:{id:m.id,code:m.code,xp:m.xp,last_checkin:m.last_checkin,unverified_invites:rr.rows[0].n},cash_cents:0,cash_payouts_enabled:false});
 }
 if(route.startsWith('/api/company-os/')){
  if(!admin(req)) return fail(res,401,'Administrator authorization required');
  if(method==='GET'&&route==='/api/company-os/overview')return send(res,200,{...await overview(pool),roles:ROLES,allowed_work:TASKS});
  if(method==='POST'&&route==='/api/company-os/work'){
   const {value}=await body(req);try{return send(res,201,{work:await createWork(pool,value)});}catch(e){return fail(res,400,e.message);}
  }
  if(method==='POST'&&route==='/api/company-os/run')return send(res,200,{execution:await runOne(pool)});
  return fail(res,404,'Unknown Company OS operation');
 }
 if(method==='POST'){
  if(route!=='/api/postback'){
   const origin=req.headers.origin;if(origin && new URL(origin).host!==req.headers.host)return fail(res,403,'Origin mismatch');
   if(!rate(req))return fail(res,429,'Rate limit exceeded');
  }
  if(route==='/api/start'){
   const old=await member(req);if(old)return send(res,200,{member:{id:old.id,code:old.code,xp:old.xp}});
   const {value}=await body(req);const ref=String(value.ref||'').trim().toLowerCase().slice(0,30);
   const par=/^[a-f0-9]{12}$/.test(ref)?await pool.query('SELECT id FROM earnloop_members WHERE code=$1',[ref]):{rows:[]};
   const token=random(32),id=crypto.randomUUID(),code=random(6);
   await pool.query('INSERT INTO earnloop_members(id,token_hash,code,referrer_id) VALUES($1,$2,$3,$4)',[id,sha(token),code,par.rows[0]?.id||null]);
   return send(res,201,{member:{id,code,xp:0}},'application/json; charset=utf-8',{'set-cookie':`el_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`});
  }
  if(route==='/api/checkin'){
   const m=await member(req);if(!m)return fail(res,401,'Join first');
   const r=await pool.query("UPDATE earnloop_members SET xp=xp+15,last_checkin=(NOW() AT TIME ZONE 'UTC')::DATE WHERE id=$1 AND (last_checkin IS NULL OR last_checkin<(NOW() AT TIME ZONE 'UTC')::DATE) RETURNING xp",[m.id]);
   return send(res,200,r.rowCount?{awarded:true,xp:r.rows[0].xp,earned_xp:15}:{awarded:false,xp:m.xp,message:'Already checked in today'});
  }
  if(route==='/api/join'){
   const {value}=await body(req),email=String(value.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return fail(res,400,'Valid email required');
   if(value.consent!==true)return fail(res,400,'Consent required');
   if(String(value.website||'').trim())return send(res,200,{accepted:true});
   const m=await member(req);
   await pool.query('INSERT INTO earnloop_waitlist(email,member_id) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',[email,m?.id||null]);
   return send(res,200,{accepted:true,message:'Founding access request received'});
  }
  if(route==='/api/postback'){
   if(!process.env.PARTNER_NAME||!process.env.PARTNER_POSTBACK_SECRET)return fail(res,503,'No verified advertiser partner connected');
   const {value,raw}=await body(req);
   const received=String(req.headers['x-earnloop-signature']||'').replace(/^sha256=/,'');
   const expected=crypto.createHmac('sha256',process.env.PARTNER_POSTBACK_SECRET).update(raw).digest('hex');
   if(!/^[a-f0-9]{64}$/.test(received)||!crypto.timingSafeEqual(Buffer.from(received,'hex'),Buffer.from(expected,'hex')))return fail(res,401,'Invalid signature');
   const eventId=String(value.event_id||''),userId=String(value.member_id||''),amount=Number(value.gross_cents);
   if(!/^[a-zA-Z0-9_-]{6,100}$/.test(eventId)||!/^[0-9a-f-]{36}$/.test(userId)||!Number.isSafeInteger(amount)||amount<0||amount>100000)return fail(res,400,'Invalid partner event');
   const reward=Math.floor(amount*.5);
   await pool.query("INSERT INTO earnloop_partner_events(provider,event_id,member_id,gross_cents,reward_cents,status) VALUES($1,$2,$3,$4,$5,'reported') ON CONFLICT(provider,event_id) DO NOTHING",[process.env.PARTNER_NAME,eventId,userId,amount,reward]);
   return send(res,202,{accepted:true,settlement:'unverified',payout:'disabled'});
  }
 }
 return fail(res,404,'Not found');
}
await init();
let loopRunning=false;
async function operationsTick(){
 if(loopRunning)return; loopRunning=true;
 try {
  const day=new Date().toISOString().slice(0,10);
  for (const type of ['snapshot_metrics','audit_partner_events','growth_diagnosis']) {
   await createWork(pool,{type,objective:`Daily evidence-backed ${type.replaceAll('_',' ')} for ${day}`,idempotency_key:`daily:${day}:${type}`});
  }
  for(let i=0;i<4;i++){const result=await runOne(pool);if(!result)break;}
 }catch(err){console.error('company_os_tick_failure',err.message);}finally{loopRunning=false;}
}
const serverHandle=http.createServer((req,res)=>{Promise.resolve(server(req,res)).catch(err=>{console.error('request_failure',err.message);if(!res.headersSent)fail(res,err.status||500,err.status?err.message:'Unexpected server error');else res.end();});});
serverHandle.listen(PORT,'0.0.0.0',()=>{console.log('earnloop_standalone_listening',PORT);operationsTick();setInterval(operationsTick,15*60*1000).unref();});
process.on('SIGTERM',()=>serverHandle.close(()=>pool.end()));
