import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {setupMemberLoop,activity,game,claimChallenge,memberJourney,referralOverview,activationFunnel,retentionMetrics} from '../src/member-loop.mjs';
import {setupCompanyOS,createWork,runOne} from '../src/company-os/engine.mjs';
import {setupEconomics,recordFinance,financeOverview} from '../src/economics.mjs';
import {discover} from '../src/company-os/opportunities.mjs';
import {recordToroxPostback} from '../src/torox-record.mjs';
import {setupRewardLedger,memberRewardStatus} from '../src/reward-ledger.mjs';
test('Postgres member progression, financial evidence and durable follow-on execution',async()=>{
 const db=new PGlite();const pool={async query(sql,args){if(!args&&sql.trim().split(';').filter(Boolean).length>1){await db.exec(sql);return {rows:[],rowCount:0};}const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};},async connect(){return {...this,release(){}};}};
 try{
 const server=fs.readFileSync('src/server.mjs','utf8');const ddl=server.match(/await pool.query\(`(CREATE TABLE IF NOT EXISTS earnloop_members[\s\S]*?)`\);/)[1];await db.exec(ddl);
 await db.exec('ALTER TABLE earnloop_members ADD COLUMN checkin_streak INT NOT NULL DEFAULT 0');
 await setupMemberLoop(pool);await setupRewardLedger(pool);await setupCompanyOS(pool);await setupEconomics(pool);
 const id='11111111-1111-4111-8111-111111111111';await pool.query('INSERT INTO earnloop_members(id,token_hash,code) VALUES($1,$2,$3)',[id,'test-only','abcdef123456']);const m={id,created_at:new Date(),xp:0};
 const referred='22222222-2222-4222-8222-222222222222';
 await pool.query('INSERT INTO earnloop_members(id,token_hash,code,referrer_id) VALUES($1,$2,$3,$4)',[referred,'referred-test-only','fedcba654321',id]);
 const before=await activationFunnel(pool);
 assert.equal(before.signups,2);
 assert.equal(before.activated,0);
 assert.equal(before.activation_rate,0);
 assert.equal(before.revenue_proven,false);
 assert.equal(before.counts_unique_people,false);
 let referrals=await referralOverview(pool,id);
 assert.equal(referrals.joined,1);
 assert.equal(referrals.activity_qualified,0);
 assert.equal(referrals.pending,1);
 await activity(pool,referred,'daily_checkin','checkin:2026-11-11',{xp:15});
 assert.equal((await referralOverview(pool,id)).activity_qualified,0);
 await activity(pool,referred,'puzzle_completed','puzzle:2026-11-11',{xp:10});
 await activity(pool,referred,'puzzle_completed','puzzle:2026-11-11',{xp:10});
 referrals=await referralOverview(pool,id);
 assert.equal(referrals.activity_qualified,1);
 assert.equal(referrals.pending,0);
 assert.equal(referrals.payable,false);
 assert.equal(referrals.identity_verified,false);
 assert.equal(referrals.cash_reward_minor,0);
 const realActivation=await activationFunnel(pool);
 assert.equal(realActivation.signups,2);
 assert.equal(realActivation.checked_in,1);
 assert.equal(realActivation.played,1);
 assert.equal(realActivation.activated,1);
 assert.equal(realActivation.activation_rate,0.5);
 assert.equal(realActivation.counts_unique_people,false);
 assert.equal(realActivation.cash_payouts_enabled,false);
 assert.ok(server.includes("route==='/api/company-os/activation'"));

 await assert.rejects(()=>claimChallenge(pool,m),/seven/);
 const round=await game(pool,m);const nums=round.question.match(/\d+/g).map(Number);assert.equal((await game(pool,m,nums[0]+nums[1])).xp,10);await assert.rejects(()=>game(pool,m,nums[0]+nums[1]),/finished/);
 for(let i=0;i<7;i++){await activity(pool,id,'daily_checkin','test-day:'+i,{xp:15});await pool.query("UPDATE earnloop_activity SET created_at=NOW()-make_interval(days=>$2) WHERE member_id=$1 AND event_key=$3",[id,i,'test-day:'+i]);}
 assert.equal((await claimChallenge(pool,m)).awarded,true);assert.equal((await claimChallenge(pool,m)).awarded,false);assert.equal((await pool.query('SELECT xp FROM earnloop_members WHERE id=$1',[id])).rows[0].xp,80);
 const journey=await memberJourney(pool,m);assert.equal(journey.challenge.days,7);assert.equal(journey.rewards.payouts_enabled,false);
 const v={kind:'cash_receipt',external_id:'test-only',provider:'test',currency:'CAD',amount_minor:100,evidence_reference:'https://example.com/test-only'};assert.equal((await recordFinance(pool,v)).recorded,true);assert.equal((await recordFinance(pool,v)).recorded,false);assert.equal((await financeOverview(pool)).verified_cash_minor,null);await assert.rejects(()=>recordFinance(pool,{...v,amount_minor:101}),/conflict/);
 const data=await discover(pool,{fetcher:async()=>new Response('public docs'),env:{}});assert.equal(data.candidates.length,5);assert.equal(data.candidates.find(x=>x.candidate_id==='torox').ranking.feasible,false);
 const w=await createWork(pool,{type:'publish_growth_campaign',objective:'Activate noncash founding challenge',idempotency_key:'test:campaign'});assert.equal((await runOne(pool)).state,'completed');assert.equal((await pool.query('SELECT state FROM earnloop_campaigns')).rows[0].state,'active');assert.equal((await pool.query("SELECT count(*)::int n FROM earnloop_os_work WHERE type='growth_diagnosis' AND state='queued'")).rows[0].n,1);assert.equal((await runOne(pool)).state,'completed');
 assert.equal((await createWork(pool,{type:'publish_growth_campaign',objective:'Activate noncash founding challenge',idempotency_key:'test:campaign'})).id,w.id);
 const cb={eventId:'conv1',memberId:id,offerId:'offer1',amountUnits:'10',publisherPayoutReported:'1',reversal:false};
 await recordToroxPostback(pool,cb);
 await recordToroxPostback(pool,{...cb,eventId:'conv2',amountUnits:'-10',publisherPayoutReported:'-1',reversal:true});
 assert.equal((await pool.query("SELECT count(*)::int n FROM earnloop_torox_postbacks WHERE status='reversal_reported'")).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM earnloop_torox_postbacks')).rows[0].n,2);
 const balance=await memberRewardStatus(pool,id);
 assert.equal(balance.source.event_count,2);
 assert.equal(balance.cash.available_for_redemption_minor,0);
 assert.equal(balance.cash.currency,null);
 assert.ok(server.includes("route==='/api/earn/balance'"));
 // Controlled historical cohort: one eligible D1/D7/D30 member, a newer
 // D1-only member. Do not count new users as churn before their window.
 await pool.query("UPDATE earnloop_members SET created_at=NOW()-INTERVAL '40 days' WHERE id=$1",[id]);
 await pool.query("UPDATE earnloop_members SET created_at=NOW()-INTERVAL '4 days' WHERE id=$1",[referred]);
 await activity(pool,id,'daily_checkin','retention-d1',{xp:0});
 await activity(pool,id,'puzzle_completed','retention-d7',{xp:0});
 for(const [eventKey,days] of [['retention-d1',1],['retention-d7',7]]){
   await pool.query("UPDATE earnloop_activity SET created_at=(SELECT created_at + make_interval(days=>$3) FROM earnloop_members WHERE id=$1) WHERE member_id=$1 AND event_key=$2",
     [id,eventKey,days]);
 }
 const retention=await retentionMetrics(pool);
 assert.deepEqual(retention.windows.d1,{eligible:2,returned:1,rate:0.5});
 assert.deepEqual(retention.windows.d7,{eligible:1,returned:1,rate:1});
 assert.deepEqual(retention.windows.d30,{eligible:1,returned:0,rate:0});
 assert.equal(retention.unique_humans_verified,false);
 assert.equal(retention.paid_user_retention_verified,false);
 assert.ok(server.includes("route==='/api/company-os/retention'"));
 }finally{await db.close();}
});
