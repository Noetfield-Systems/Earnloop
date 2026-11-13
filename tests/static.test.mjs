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

test('existing governed coding runner logs idle readiness and resumes only after independent proof',()=>{
 const workflow=fs.readFileSync('.github/workflows/company-os-delivery.yml','utf8');
 const runner=fs.readFileSync('scripts/company-os-delivery.py','utf8');
 const closeout=fs.readFileSync('scripts/company-os-closeout.py','utf8');
 assert.match(runner,/canonical_intake_state/);
 assert.match(runner,/ack_quarantined/);
 assert.match(runner,/missing_decision/);
 assert.match(workflow,/id: verified/);
 assert.match(workflow,/steps\.verified\.outputs\.state == 'TECHNICALLY_VERIFIED'/);
 assert.match(workflow,/gh workflow run company-os-delivery\.yml --ref main/);
 assert.match(closeout,/result\.get\('state'\)!='TECHNICALLY_VERIFIED'/);
 assert.match(closeout,/GITHUB_OUTPUT/);
 assert.match(closeout,/stream\.write\('state=TECHNICALLY_VERIFIED' \+ chr\(10\)\)/);
 assert.doesNotMatch(workflow,/\bpush --force\b/);
});
