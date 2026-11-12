import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { toroxConfigured, createToroxWallSession, parseToroxPostback } from '../src/torox.mjs';

const env={
  TOROX_PUBLISHER_APPROVED:'true',
  TOROX_APPROVAL_REFERENCE:'publisher-contract-2026-11',
  TOROX_PLACEMENT_ID:'app123',
  TOROX_APP_TOKEN:'A-secret-server-only-partner-token',
  TOROX_MODE:'staging'
};
const uid='0154fe01-0222-4333-8444-abcdefaabbcc';

test('fails closed without publisher acceptance', async()=>{
  assert.equal(toroxConfigured({...env,TOROX_PUBLISHER_APPROVED:'false'}),false);
  await assert.rejects(createToroxWallSession(uid,{env:{...env,TOROX_PUBLISHER_APPROVED:'false'}}),/PUBLISHER_NOT_APPROVED/);
});
test('uses exact server-to-server Torox session without exposing secret in result',async()=>{
  let called;
  const fetcher=async(url,options)=>{
    called={url:url.toString(),options};
    return {ok:true,json:async()=>({ok:true,wall_url:'https://wall.stage.torox.io/random-session-token'})};
  };
  const wall=await createToroxWallSession(uid,{env,fetcher});
  assert.equal(wall,'https://wall.stage.torox.io/random-session-token');
  assert.equal(new URL(called.url).pathname,'/partner/session');
  assert.equal(new URL(called.url).searchParams.get('placement_id'),'app123');
  assert.equal(JSON.parse(called.options.body).player.uid,uid);
  assert.equal(called.options.redirect,'error');
  assert.equal(wall.includes(env.TOROX_APP_TOKEN),false);
});
test('will not return malicious wall origin',async()=>{
  await assert.rejects(createToroxWallSession(uid,{env,fetcher:async()=>({
    ok:true,json:async()=>({ok:true,wall_url:'https://phishing.example/wall'})
  })}),/PARTNER_WALL_ORIGIN_REJECTED/);
});
test('signed Torox conversion is a source report, never spendable cash',()=>{
  const oid='124567';
  const sig=crypto.createHash('md5').update(oid+'-'+uid+'-'+env.TOROX_APP_TOKEN).digest('hex');
  const url=new URL('https://earnloop.example/api/partner/torox/postback');
  for(const [key,value] of Object.entries({id:'8811',oid,user_id:uid,sig,amount:'250.50',payout:'3.25'}))
    url.searchParams.set(key,value);
  const event=parseToroxPostback(url,env);
  assert.equal(event.reversal,false);
  assert.equal(event.publisherPayoutReported,'3.25');
  assert.equal(event.amountUnits,'250.50');
  url.searchParams.set('amount','-250.50');
  assert.equal(parseToroxPostback(url,env).reversal,true);
  url.searchParams.set('amount','250.50');
  assert.throws(()=>parseToroxPostback(url,env),/INCONSISTENT_REVERSAL/);
  url.searchParams.set('amount','-250.50');
  url.searchParams.set('sig','0'.repeat(32));
  assert.throws(()=>parseToroxPostback(url,env),/BAD_POSTBACK_SIGNATURE/);
});
