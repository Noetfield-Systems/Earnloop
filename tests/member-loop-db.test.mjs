import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {setupMemberLoop,activity,game,claimChallenge,memberJourney} from '../src/member-loop.mjs';
import {setupCompanyOS,createWork,runOne} from '../src/company-os/engine.mjs';
import {setupEconomics,recordFinance,financeOverview} from '../src/economics.mjs';
import {discover} from '../src/company-os/opportunities.mjs';
test('Postgres member progression, financial evidence and durable follow-on execution',async()=>{
 const db=new PGlite();const pool={async query(sql,args){if(!args&&sql.trim().split(';').filter(Boolean).length>1){await db.exec(sql);return {rows:[],rowCount:0};}const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};},async connect(){return {...this,release(){}};}};
 try{
 const server=fs.readFileSync('src/server.mjs','utf8');const ddl=server.match(/await pool.query\(`(CREATE TABLE IF NOT EXISTS earnloop_members[\s\S]*?)`\);/)[1];await db.exec(ddl);
 await db.exec('ALTER TABLE earnloop_members ADD COLUMN checkin_streak INT NOT NULL DEFAULT 0');
 await setupMemberLoop(pool);await setupCompanyOS(pool);await setupEconomics(pool);
 const id='11111111-1111-4111-8111-111111111111';await pool.query('INSERT INTO earnloop_members(id,token_hash,code) VALUES($1,$2,$3)',[id,'test-only','abcdef123456']);const m={id,created_at:new Date(),xp:0};
 await assert.rejects(()=>claimChallenge(pool,m),/seven/);
 const round=await game(pool,m);const nums=round.question.match(/\d+/g).map(Number);assert.equal((await game(pool,m,nums[0]+nums[1])).xp,10);await assert.rejects(()=>game(pool,m,nums[0]+nums[1]),/finished/);
 for(let i=0;i<7;i++){await activity(pool,id,'daily_checkin','test-day:'+i,{xp:15});await pool.query("UPDATE earnloop_activity SET created_at=NOW()-make_interval(days=>$2) WHERE member_id=$1 AND event_key=$3",[id,i,'test-day:'+i]);}
 assert.equal((await claimChallenge(pool,m)).awarded,true);assert.equal((await claimChallenge(pool,m)).awarded,false);assert.equal((await pool.query('SELECT xp FROM earnloop_members WHERE id=$1',[id])).rows[0].xp,80);
 const journey=await memberJourney(pool,m);assert.equal(journey.challenge.days,7);assert.equal(journey.rewards.payouts_enabled,false);
 const v={kind:'cash_receipt',external_id:'test-only',provider:'test',currency:'CAD',amount_minor:100,evidence_reference:'https://example.com/test-only'};assert.equal((await recordFinance(pool,v)).recorded,true);assert.equal((await recordFinance(pool,v)).recorded,false);assert.equal((await financeOverview(pool)).verified_cash_minor,null);await assert.rejects(()=>recordFinance(pool,{...v,amount_minor:101}),/conflict/);
 const data=await discover(pool,{fetcher:async()=>new Response('public docs'),env:{}});assert.equal(data.candidates.length,5);assert.equal(data.candidates.find(x=>x.candidate_id==='torox').ranking.feasible,false);
 const w=await createWork(pool,{type:'publish_growth_campaign',objective:'Activate noncash founding challenge',idempotency_key:'test:campaign'});assert.equal((await runOne(pool)).state,'completed');assert.equal((await pool.query('SELECT state FROM earnloop_campaigns')).rows[0].state,'active');assert.equal((await pool.query("SELECT count(*)::int n FROM earnloop_os_work WHERE type='growth_diagnosis' AND state='queued'")).rows[0].n,1);assert.equal((await runOne(pool)).state,'completed');
 assert.equal((await createWork(pool,{type:'publish_growth_campaign',objective:'Activate noncash founding challenge',idempotency_key:'test:campaign'})).id,w.id);
 const sql=server.match(/`(INSERT INTO earnloop_torox_postbacks[\s\S]*?)`,/)[1];await pool.query(sql,['conv1',id,'offer1','10','1',false,'reported_unsettled']);await pool.query(sql,['conv1',id,'offer1','-10','-1',true,'reversal_reported']);await pool.query(sql,['conv1',id,'offer1','10','1',false,'reported_unsettled']);assert.equal((await pool.query('SELECT status FROM earnloop_torox_postbacks')).rows[0].status,'reversal_reported');
 }finally{await db.close();}
});
