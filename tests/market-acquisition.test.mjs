import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/sponsor.html',import.meta.url),'utf8');
const css=await readFile(new URL('../public/sponsor.css',import.meta.url),'utf8');
const client=await readFile(new URL('../public/member-loop.js',import.meta.url),'utf8');
const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
test('partner acquisition page includes an actionable existing lead capture route',()=>{
 for(const field of ['sponsorForm','sponsorEmail','sponsorName','sponsorSite','sponsorGoal','sponsorBudget','sponsorBrief','sponsorConsent','sponsorStatus'])
  assert.match(html,new RegExp('id="'+field+'"'));
 assert.match(client,/\/api\/sponsor/);
 assert.match(server,/route==='\/api\/sponsor'/);
});
test('business-facing disclosures distinguish contracted work, provider revenue and future payouts',()=>{
 for(const claim of ['C$299','No charge before scope acceptance','No live sponsored inventory claimed','No fabricated reach','separate'])assert.ok(html.includes(claim),claim);
 assert.match(html,/href="\/privacy"/);
 assert.match(html,/name="viewport"/);
});
test('all public assets are served by product runtime and responsive',()=>{
 assert.match(server,/'\/sponsor\.css':'sponsor\.css'/);
 assert.match(html,/href="\/sponsor\.css"/);
 assert.match(html,/src="\/member-loop\.js"/);
 assert.match(css,/@media\(max-width:760px\)/);
});
test('optional structured sponsor intake is included in existing lead brief and size bound',()=>{
 for(const id of ['sponsorName','sponsorGoal','sponsorBudget']) assert.ok(client.includes(id));
 assert.match(client,/slice\(0,2000\)/);
});