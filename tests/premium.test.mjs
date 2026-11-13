import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('premium member experience ships with discoverable pages and assets',()=>{
  const html=read('public/index.html');
  const css=read('public/premium.css');
  const js=read('public/experience.js');
  const server=read('src/server.mjs');
  for(const id of ['experience','experienceStatus','streakCount','progressFill','referralCount','journeyDaily','invitationLink','copyInvitePremium','faq']){
    assert.ok(html.includes(id),id);
  }
  for(const asset of ['/premium.css','/experience.js']){
    assert.ok(html.includes(asset),'HTML loads '+asset);
    assert.ok(server.includes("'"+asset+"'"),'Server serves '+asset);
  }
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(js.includes('earnloop:updated'));
  assert.ok(html.includes('role="progressbar"'));
  assert.ok(html.includes('aria-live="polite"'));
});

test('daily streaks are server-backed, UTC-based and reward-safe',()=>{
  const server=read('src/server.mjs');
  assert.ok(server.includes('ADD COLUMN IF NOT EXISTS checkin_streak'));
  assert.ok(server.includes('checkin_streak=CASE WHEN last_checkin='));
  assert.ok(server.includes("TIME ZONE 'UTC'"));
  assert.ok(server.includes('streak:m.checkin_streak'));
  assert.ok(server.includes('cash_payouts_enabled:false'));
  assert.ok(server.includes("payout:'disabled'"));
});

test('premium marketing clearly distinguishes community XP from funded rewards',()=>{
  const html=read('public/index.html');
  assert.match(html,/not redeemable/i);
  assert.match(html,/verified partner/i);
  assert.match(html,/never present community XP as cash/i);
  assert.doesNotMatch(html,/(?:guaranteed|instant) cash(?:out| rewards)/i);
});

test('member referrals show engaged invitees separately from raw signups',()=>{
  const html=read('public/index.html');
  const client=read('public/experience.js');
  const server=read('src/server.mjs');
  const memberLoop=read('src/member-loop.mjs');
  assert.match(html,/activity-qualified after a check-in and a completed daily puzzle/);
  assert.match(client,/activity_qualified_invites/);
  assert.match(client,/active \/ /);
  assert.match(server,/referralOverview\(pool,m.id\)/);
  assert.match(memberLoop,/kind='daily_checkin'/);
  assert.match(memberLoop,/kind='puzzle_completed'/);
  assert.match(memberLoop,/identity_verified:false,payable:false,cash_reward_minor:0/);
});

test('Earn discovery keeps working free earn, play and invite paths available without sponsored supply',()=>{
  const html=read('public/earn.html');
  const home=read('public/index.html');
  const client=read('public/earn.js');
  assert.match(html,/id="earn-next-actions"/);
  for(const [href,target] of [['/#quests','id="quests"'],['/#play','id="play"'],['/#experience','id="experience"']]){
    assert.ok(html.includes('href="'+href+'"'),'real next step links to '+href);
    assert.ok(home.includes(target),'destination exists '+target);
  }
  assert.match(html,/A friend becomes activity-qualified only after checking in and completing a puzzle/);
  assert.match(html,/Invites never create a cash reward/);
  assert.match(html,/Free community activities · no cash promise/);
  assert.match(client,/No paid partner offer inventory is available yet/);
});
