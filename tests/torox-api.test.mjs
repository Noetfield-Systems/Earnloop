import test from 'node:test';
import assert from 'node:assert/strict';
import {toroxApiConfigured,listToroxOffers,createToroxOfferClick} from '../src/torox-api.mjs';
const env={TOROX_PUBLISHER_APPROVED:'true',TOROX_APPROVAL_REFERENCE:'account-approved',
  TOROX_PLACEMENT_ID:'placement123',TOROX_APP_TOKEN:'A-secret-server-only-credential',
  TOROX_MODE:'staging',TOROX_API_ENABLED:'true'};
const member='11111111-1111-4111-8111-111111111111';
test('native Torox inventory remains gated behind separate API entitlement',async()=>{
  assert.equal(toroxApiConfigured({...env,TOROX_API_ENABLED:'false'}),false);
  await assert.rejects(listToroxOffers({geo:'CA',os:'android',env:{...env,TOROX_API_ENABLED:'false'}}),/NOT_APPROVED/);
  await assert.rejects(listToroxOffers({geo:'Canada',os:'android',env}),/INVALID_OFFER_ELIGIBILITY/);
});
test('partner catalog is filtered by geography and device; no token or publisher payout is exposed',async()=>{
  let called=null, calls=0;
  const fetcher=async(url,options)=>{
    calls++;called={url:new URL(url),options};
    return {ok:true,json:async()=>[{offerId:1234,name:'Play a verified game',description:'Complete milestones.',
      amount:450,os:'mobile',payout:9.55,verticalNames:['Games'],events:[{eventName:'Level 5',amount:120}]}]};
  };
  const result=await listToroxOffers({geo:'CA',os:'android',env,fetcher,now:100});
  assert.equal(called.url.host,'api.wall.stage.torox.io');
  assert.equal(called.url.searchParams.get('geo'),'CA');
  assert.equal(called.url.searchParams.get('os'),'android');
  assert.equal(called.url.searchParams.get('source_id'),'placement123');
  assert.equal(result.offers.length,1);
  assert.equal(result.offers[0].milestones[0].name,'Level 5');
  assert.equal(result.offers[0].reward_units,450);
  assert.equal(result.offers[0].payout,undefined);
  assert.equal(JSON.stringify(result).includes(env.TOROX_APP_TOKEN),false);
  await listToroxOffers({geo:'CA',os:'android',env,fetcher,now:200});
  assert.equal(calls,1);
});
test('click creates user-specific URL and rejects off-domain redirect',async()=>{
  const fetcher=async(url)=>{
    const u=new URL(url);
    assert.equal(u.searchParams.get('uid'),member);
    assert.equal(u.searchParams.get('campaign_id'),'1234');
    assert.equal(u.searchParams.get('geo'),'GB');
    return {ok:true,json:async()=>({ok:true,clickUrl:'https://torox.io/click_track/track/1234/?player_uid=abc'})};
  };
  const href=await createToroxOfferClick(member,{geo:'GB',campaignId:'1234',env,fetcher});
  assert.match(href,/torox\.io\/click_track/);
  await assert.rejects(createToroxOfferClick(member,{geo:'GB',campaignId:'1234',env,
    fetcher:async()=>({ok:true,json:async()=>({ok:true,clickUrl:'https://phishing.example/redirect'})})}),/ORIGIN_REJECTED/);
  await assert.rejects(createToroxOfferClick(member,{geo:'G B',campaignId:'1234',env,fetcher}),/INVALID_OFFER_CLICK/);
});
