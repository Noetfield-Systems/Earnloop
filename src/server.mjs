import {setupMemberLoop,activity,memberJourney,claimChallenge,game} from './member-loop.mjs';
import {setupEconomics,recordFinance,financeOverview} from './economics.mjs';
import {opportunityOverview} from './company-os/opportunities.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {setupCompanyOS,createWork,runOne,overview,metrics} from './company-os/engine.mjs';
import {ROLES,TASKS} from './company-os/policy.mjs';
import {setupCommercial,listCommercial,approveCommercial,configureContact,dispatchCommercial,recordCommercialEvidence} from './company-os/commercial.mjs';
import {REPLICATION_TARGETS,nextCommercialAction} from './company-os/replication.mjs';
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
function founderApproval(req){
 const key=process.env.COMMERCIAL_FOUNDER_APPROVAL_TOKEN;
 const supplied=String(req.headers['x-founder-approval-token']||'');
 if(!key||key.length<32||!supplied)return false;
 const left=crypto.createHash('sha256').update(supplied).digest();
 const right=crypto.createHash('sha256').update(key).digest();
 return crypto.timingSafeEqual(left,right);
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
async function member(req){const token=cookie(req);if(!token)return null;const r=await pool.query('SELECT id,code,xp,last_checkin,checkin_streak,created_at FROM earnloop_members WHERE token_hash=$1',[sha(token)]);return r.rows[0]||null;}
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
 await pool.query('ALTER TABLE earnloop_members ADD COLUMN IF NOT EXISTS checkin_streak INT NOT NULL DEFAULT 0 CHECK(checkin_streak>=0)');
 await setupMemberLoop(pool);
 await setupEconomics(pool);
 await setupCompanyOS(pool);
 await setupCommercial(pool);
}
async function server(req,res){
 const url=new URL(req.url||'/', 'https://localhost');const route=url.pathname,method=req.method||'GET';
 if(method==='GET'&&route==='/health'){
  try{await pool.query('SELECT 1');return send(res,200,{ok:true,database:'connected',product:'earnloop',company_os:'dedicated',cash_payouts_enabled:false,revision:process.env.RAILWAY_GIT_COMMIT_SHA||null});}
  catch{return fail(res,503,'Database unavailable');}
 }
 const files={'/':'index.html','/challenge':'index.html','/sponsor':'sponsor.html','/guide':'guide.html','/member-loop.js':'member-loop.js','/loop.css':'loop.css','/social.svg':'social.svg','/privacy':'privacy.html','/terms':'terms.html','/company-os':'company-os.html','/style.css':'style.css','/premium.css':'premium.css','/app.js':'app.js','/experience.js':'experience.js','/company-os.js':'company-os.js'};
 if(method==='GET'&&Object.hasOwn(files,route)){
  const file=files[route],type=file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8';
  const raw=await fs.readFile(path.join(root,'public',file));return send(res,200,raw,type);
 }
 if(method==='GET'&&route==='/robots.txt')return send(res,200,'User-agent: *\nAllow: /\nDisallow: /company-os\nDisallow: /api/\nSitemap: https://earnloop-web-production.up.railway.app/sitemap.xml','text/plain');
 if(method==='GET'&&route==='/sitemap.xml')return send(res,200,'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/challenge','/guide','/sponsor'].map(p=>'<url><loc>https://earnloop-web-production.up.railway.app'+p+'</loc></url>').join('')+'</urlset>','application/xml');
 if(method==='GET'&&route==='/api/journey'){const m=await member(req);if(!m)return fail(res,401,'Join first');return send(res,200,await memberJourney(pool,m));}
 if(method==='GET'&&route==='/api/game'){const m=await member(req);if(!m)return fail(res,401,'Join first');return send(res,200,await game(pool,m));}
 if(method==='GET'&&route==='/api/offerwall/status')
  return send(res,200,{provider:'torox',enabled:toroxConfigured(),
   status:toroxConfigured()?'PUBLISHER_APPROVED_SESSION_AVAILABLE':'PUBLISHER_APPROVAL_REQUIRED',
   payouts_enabled:false,source_reports_are_collected_revenue:false});
 if(method==='GET'&&route==='/api/offerwall/session'){
  if(!toroxConfigured())return fail(res,503,'Publisher approval pending');
  if(!rate(req,10))return fail(res,429,'Rate limit exceeded');
  const m=await member(req);if(!m)return fail(res,401,'Join first');
  try{const wall_url=await createToroxWallSession(m.id);
    await activity(pool,m.id,'offer_started','offerwall:'+crypto.randomUUID(),{provider:'torox'});
    return send(res,200,{wall_url,provider:'torox',payouts_enabled:false});}
  catch{return fail(res,502,'Partner session temporarily unavailable');}
 }
 if(method==='GET'&&route==='/api/partner/torox/postback'){
  if(!toroxConfigured())return send(res,503,'0','text/plain; charset=utf-8');
  try{
   const e=parseToroxPostback(url);
   await pool.query(
    `INSERT INTO earnloop_torox_postbacks(event_id,member_id,offer_id,amount_units,publisher_payout_reported_usd,reversal,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,event_id) DO UPDATE SET reversal=TRUE,status='reversal_reported' WHERE EXCLUDED.reversal=TRUE AND earnloop_torox_postbacks.member_id=EXCLUDED.member_id AND earnloop_torox_postbacks.offer_id=EXCLUDED.offer_id`,
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
  return send(res,200,{member:{id:m.id,code:m.code,xp:m.xp,last_checkin:m.last_checkin,unverified_invites:rr.rows[0].n,streak:m.checkin_streak},cash_cents:0,cash_payouts_enabled:false});
 }
 if(route.startsWith('/api/company-os/')){
  if(!admin(req)) return fail(res,401,'Administrator authorization required');
  if(method==='GET'&&route==='/api/company-os/opportunities')return send(res,200,{candidates:await opportunityOverview(pool)});
  if(method==='GET'&&route==='/api/company-os/finance')return send(res,200,await financeOverview(pool));
  if(method==='GET'&&route==='/api/company-os/support')return send(res,200,{cases:(await pool.query('SELECT * FROM earnloop_support ORDER BY created_at DESC LIMIT 100')).rows,sponsor_leads:(await pool.query('SELECT * FROM earnloop_sponsor_leads ORDER BY created_at DESC LIMIT 100')).rows});
  if(method==='POST'&&route==='/api/company-os/finance'){const {value}=await body(req);try{return send(res,201,await recordFinance(pool,value));}catch(e){return fail(res,400,e.message);}}
  if(method==='GET'&&route==='/api/company-os/commercial')return send(res,200,await listCommercial(pool));
  if(method==='POST'&&route.startsWith('/api/company-os/commercial/')){
   const operation=route.slice('/api/company-os/commercial/'.length);
   if(!['approve','send','contact','evidence'].includes(operation))return fail(res,404,'Unknown commercial operation');
   if((operation==='approve'||operation==='contact')&&!founderApproval(req))return fail(res,403,'Separate founder approval required');
   const {value}=await body(req);
   try{
    let result;
    if(operation==='approve')result=await approveCommercial(pool,String(value.key||''));
    if(operation==='contact')result=await configureContact(pool,String(value.key||''),String(value.email||''),String(value.source||''));
    if(operation==='send')result=await dispatchCommercial(pool,String(value.key||''));
    if(operation==='evidence')result=await recordCommercialEvidence(pool,String(value.key||''),String(value.kind||''),String(value.reference||''));
    return send(res,200,{commercial:result});
   }catch(e){return fail(res,400,e.message);}
  }
  if(method==='GET'&&route==='/api/company-os/replication') return send(res,200,{targets:REPLICATION_TARGETS,next_action:nextCommercialAction(await metrics(pool),process.env)});
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
  if(route==='/api/sponsor'){
   const {value}=await body(req);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email||'')||String(value.email).length>254||typeof value.brief!=='string'||value.brief.length<20||value.brief.length>2000||value.consent!==true)return fail(res,400,'Valid email, project brief and consent required');
   const id=crypto.randomUUID();await pool.query('INSERT INTO earnloop_sponsor_leads(id,email,brief) VALUES($1,$2,$3)',[id,value.email,value.brief]);
   await createWork(pool,{type:'draft_partner_outreach',objective:'Review inbound sponsor brief '+id,idempotency_key:'sponsor:'+id});return send(res,201,{id,message:'Inquiry saved. No payment or contract has been created.'});
  }
  if(['/api/challenge/claim','/api/game','/api/support'].includes(route)){
   const m=await member(req);if(!m)return fail(res,401,'Join first');const {value}=await body(req);
   try{
    if(route==='/api/game')return send(res,200,await game(pool,m,value.answer));
    if(route==='/api/challenge/claim')return send(res,200,await claimChallenge(pool,m));
    if(typeof value.subject!=='string'||value.subject.length<5||value.subject.length>100||typeof value.message!=='string'||value.message.length<10||value.message.length>2000)return fail(res,400,'Add a subject and description (up to 2,000 characters)');
    const id=crypto.randomUUID();await pool.query('INSERT INTO earnloop_support(id,member_id,subject,message) VALUES($1,$2,$3,$4)',[id,m.id,value.subject,value.message]);return send(res,201,{id,state:'open'});
   }catch(e){return fail(res,400,e.message);}
  }
  if(route==='/api/start'){
   const old=await member(req);if(old)return send(res,200,{member:{id:old.id,code:old.code,xp:old.xp}});
   const {value}=await body(req);const ref=String(value.ref||'').trim().toLowerCase().slice(0,30);
   const par=/^[a-f0-9]{12}$/.test(ref)?await pool.query('SELECT id FROM earnloop_members WHERE code=$1',[ref]):{rows:[]};
   const token=random(32),id=crypto.randomUUID(),code=random(6);
   const c=await pool.connect();try{await c.query('BEGIN');
   await c.query('INSERT INTO earnloop_members(id,token_hash,code,referrer_id) VALUES($1,$2,$3,$4)',[id,sha(token),code,par.rows[0]?.id||null]);
   await activity(c,id,'member_created','signup',{source:/^[a-zA-Z0-9_-]{1,40}$/.test(value.source||'')?value.source:(par.rows[0]?'referral':'direct')});
   await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   return send(res,201,{member:{id,code,xp:0}},'application/json; charset=utf-8',{'set-cookie':`el_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`});
  }
  if(route==='/api/checkin'){
   const m=await member(req);if(!m)return fail(res,401,'Join first');
   const c=await pool.connect();try{await c.query('BEGIN');
   const r=await c.query("UPDATE earnloop_members SET xp=xp+15,checkin_streak=CASE WHEN last_checkin=((NOW() AT TIME ZONE 'UTC')::DATE - 1) THEN checkin_streak+1 ELSE 1 END,last_checkin=(NOW() AT TIME ZONE 'UTC')::DATE WHERE id=$1 AND (last_checkin IS NULL OR last_checkin<(NOW() AT TIME ZONE 'UTC')::DATE) RETURNING xp,checkin_streak,last_checkin",[m.id]);
   if(r.rowCount)await activity(c,m.id,'daily_checkin','checkin:'+new Date(r.rows[0].last_checkin).toISOString().slice(0,10),{xp:15});
   await c.query('COMMIT');
   return send(res,200,r.rowCount?{awarded:true,xp:r.rows[0].xp,streak:r.rows[0].checkin_streak,earned_xp:15}:{awarded:false,xp:m.xp,streak:m.checkin_streak,message:'Already checked in today'});
   }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
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
  for (const type of ['discover_opportunities','snapshot_metrics','audit_partner_events','growth_diagnosis','replication_launch_check']) {
   await createWork(pool,{type,objective:`Daily evidence-backed ${type.replaceAll('_',' ')} for ${day}`,idempotency_key:`daily:${day}:${type}`});
  }
  for(let i=0;i<8;i++){const result=await runOne(pool);if(!result)break;console.log('company_os_execution',JSON.stringify(result));}
 }catch(err){console.error('company_os_tick_failure',err.message);}finally{loopRunning=false;}
}
const serverHandle=http.createServer((req,res)=>{Promise.resolve(server(req,res)).catch(err=>{console.error('request_failure',err.message);if(!res.headersSent)fail(res,err.status||500,err.status?err.message:'Unexpected server error');else res.end();});});
serverHandle.listen(PORT,'0.0.0.0',()=>{console.log('earnloop_standalone_listening',PORT);operationsTick();setInterval(operationsTick,15*60*1000).unref();});
process.on('SIGTERM',()=>serverHandle.close(()=>pool.end()));
