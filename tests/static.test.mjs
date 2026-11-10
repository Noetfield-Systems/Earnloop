import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('standalone code retains production member tables and callback safeguard',()=>{
 const code=fs.readFileSync('src/server.mjs','utf8');
 for(const piece of ['earnloop_members','earnloop_waitlist','earnloop_partner_events','PARTNER_POSTBACK_SECRET','settlement:\'unverified\'','payout:\'disabled\'']) assert.ok(code.includes(piece),piece);
});
test('Company OS does not expose money movement through a runner',()=>{
 const code=fs.readFileSync('src/company-os/engine.mjs','utf8');
 assert.equal(code.includes('authorize_reward_payout:'),false);
 assert.ok(code.includes('FOR UPDATE SKIP LOCKED'));
});
