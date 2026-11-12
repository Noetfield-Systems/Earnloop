import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {setupOperations,operate,memberOffers,provisionalMargin,sourceRewardCreditReadiness} from '../src/operations.mjs';

const charges={provider_share:{amount_minor:40,currency:'USD'},user_reward:{amount_minor:120,currency:'USD'},
 referral:{amount_minor:10,currency:'USD'},processing:{amount_minor:8,currency:'USD'},
 fulfillment:{amount_minor:5,currency:'USD'},acquisition:{amount_minor:30,currency:'USD'},
 reversal:{amount_minor:0,currency:'USD'},support:{amount_minor:4,currency:'USD'}};

test('actual projected partner event cannot mint reward eligibility without independent cash and callback evidence',()=>{
 const env={TOROX_PUBLISHER_APPROVED:'true',TOROX_APPROVAL_REFERENCE:'approval-source',
  TOROX_PLACEMENT_ID:'test-placement',TOROX_APP_TOKEN:'t'.repeat(24),TOROX_MODE:'staging'};
 const projected={provider:'torox',reversed:false,gross_minor:800,reward_minor:200,
  cash_verified:true,callbackVerified:true,economics:{expenses:{user_reward:200}}};
 const result=sourceRewardCreditReadiness(projected,env);
 assert.equal(result.state,'PARTNER_CALLBACK_UNVERIFIED');
 assert.equal(result.creditReady,false);
 assert.equal(result.payoutReady,false);
 assert.equal(result.independently_collected_cash,false);
 assert.equal(result.evidence_state,'SOURCE_REPORTED_UNVERIFIED');
});
test('unapproved provider and absent reward liability are correctly rejected',()=>{
 const env={TOROX_PUBLISHER_APPROVED:'false'};
 const event={provider:'torox',reversed:false,gross_minor:800,reward_minor:200,
  economics:{expenses:{user_reward:200}}};
 assert.equal(sourceRewardCreditReadiness(event,env).state,'PUBLISHER_NOT_APPROVED');
 assert.equal(sourceRewardCreditReadiness({...event,reward_minor:null,economics:{expenses:{}}},env).state,'INVALID_ACCOUNTING');
 assert.equal(sourceRewardCreditReadiness({...event,reversed:true},env).payoutReady,false);
 assert.equal(sourceRewardCreditReadiness({...event,gross_minor:'not-money'},env).creditReady,false);
});

test('reported conversion cannot be verified profit even with a full reported cost schedule',()=>{
 const p=provisionalMargin({currency:'USD',gross_minor:250,reward_minor:null},charges);
 assert.equal(p.contribution_minor,33);
 assert.equal(p.verified_contribution_minor,null);
 assert.equal(p.valuation,'source_report_only');
 assert.deepEqual(p.missing_costs,[]);
});
test('missing source costs and mixed currencies cannot produce margin',()=>{
 const incomplete=provisionalMargin({currency:'USD',gross_minor:250,reward_minor:120},{});
 assert.equal(incomplete.contribution_minor,null);
 assert.ok(incomplete.missing_costs.includes('processing'));
 const wrongCurrency=provisionalMargin({currency:'USD',gross_minor:250,reward_minor:null},{...charges,provider_share:{amount_minor:40,currency:'CAD'}});
 assert.equal(wrongCurrency.contribution_minor,null);
 assert.ok(wrongCurrency.missing_costs.includes('provider_share'));
 const unknownCurrency=provisionalMargin({currency:null,gross_minor:250,reward_minor:120},charges);
 assert.equal(unknownCurrency.contribution_minor,null);
});
test('isolated operations schema begins with only four planned tracks, no invented offers, transactions or payouts',async()=>{
 const db=new PGlite();
 const pool={query:async(sql,args)=>{
  if(args===undefined&&sql.includes(';')){await db.exec(sql);return {rows:[],rowCount:0};}
  const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};
 }};
 try{
  await db.exec('CREATE TABLE earnloop_members(id UUID PRIMARY KEY);');
  await setupOperations(pool);
  const tracks=(await db.query('SELECT track,state FROM earnloop_ops_experiments ORDER BY track')).rows;
  assert.deepEqual(tracks.map(x=>x.track),['A','B','C','D']);
  assert.ok(tracks.every(x=>x.state==='planned'));
  assert.equal((await db.query('SELECT count(*)::int n FROM earnloop_ops_offers')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM earnloop_ops_redemptions')).rows[0].n,0);
  assert.equal((await memberOffers(pool)).offers.length,0);
  const created=await operate(pool,{action:'offer_create',track:'B',title:'Isolated unit test sponsor',
   provider:'test-only',description:'Local test not connected to any live sponsor.',
   source_reference:'https://example.org/evidence/unit-test',destination_url:'https://example.org/offer/unit-test'});
  assert.equal(created.state,'draft');
  assert.equal(created.verified_inventory,false);
  await assert.rejects(operate(pool,{action:'offer_state',id:created.id,state:'operator_published'}),/approval evidence/);
  assert.equal((await memberOffers(pool)).offers.length,0);
  const published=await operate(pool,{action:'offer_state',id:created.id,state:'operator_published',
   approval_reference:'https://example.org/evidence/approval-unit-test'});
  assert.equal(published.classification,'operator_reported');
  assert.equal((await memberOffers(pool)).offers.length,1);
  const receipt=await operate(pool,{action:'evidence',provider:'torox',event_id:'event-1',kind:'bank_receipt',
   source_url:'https://example.org/evidence/local-only'});
  assert.equal(receipt.cash_verified,false);
 }finally{await db.close();}
});
