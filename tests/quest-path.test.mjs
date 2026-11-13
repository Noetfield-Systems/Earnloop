import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../public/quest-path.js",import.meta.url),"utf8");
const earn=fs.readFileSync(new URL("../public/earn.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/earn.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/quest-path.css",import.meta.url),"utf8");
function fixture(){
 const nodes={};
 for(const id of ["questMap","questMapCount","questMapNext","questMapFeedback"])
   nodes[id]={innerHTML:"",textContent:"",href:"",dataset:{}};
 const events={};
 const context={document:{getElementById:id=>nodes[id]||null,addEventListener:(name,fn)=>events[name]=fn},
 window:{},Date,Math,Number,String,Array,Object};
 vm.runInNewContext(source,context);
 return {nodes,events,api:context.window.EarnloopQuest};
}
test("quest map is bound to existing real Earnloop endpoints, not a second points or cash ledger",()=>{
 assert.match(html,/id="questMap"/);
 assert.match(html,/id="questMapCount"/);
 assert.match(html,/\/quest-path.js/);
 assert.match(html,/\/quest-path.css/);
 assert.match(css,/\.reward-station\.earned/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(earn,/await api\('\/api\/journey'\)/);
 assert.match(earn,/earnloop:member-journey/);
 assert.doesNotMatch(source, /localStorage|setItem|cash_cents|await fetch|\/api\/checkin/);
});
test("starts at a real membership task with no fabricated achievements",()=>{
 const {nodes,api}=fixture();
 const stages=api.stations(null,null,0,{enabled:false},"2026-11-12");
 assert.equal(stages.length,6);
 assert.equal(stages.filter(x=>x.complete).length,0);
 assert.equal(stages[0].available,true);
 assert.equal(stages[1].available,false);
 api.render({member:null,journey:null,offerCount:0,offerwall:{enabled:false}});
 assert.equal(nodes.questMapCount.textContent,"0 / 6");
 assert.equal(nodes.questMapNext.href,"#memberState");
 assert.match(nodes.questMap.innerHTML,/Partner inventory has not been confirmed/);
 assert.doesNotMatch(nodes.questMap.innerHTML,/✓ Done/);
});
test("daily checked/puzzle milestones are UTC-dated and actual activity driven",()=>{
 const {api}=fixture();const member={code:"a",xp:35,activity_qualified_invites:0};
 const journey={activity:[
   {kind:"daily_checkin",created_at:"2026-11-12T13:02:00Z"},
   {kind:"puzzle_completed",created_at:"2026-11-11T22:00:00Z"}
 ],partner_reports:[]};
 const stages=api.stations(member,journey,0,{enabled:false},"2026-11-12");
 assert.equal(stages[0].complete,true);
 assert.equal(stages[1].complete,true);
 assert.equal(stages[2].complete,false);
 assert.equal(stages[3].complete,false);
 assert.equal(stages[4].available,false);
 assert.equal(stages[5].complete,false);
 assert.equal(api.stations(member,journey,0,{enabled:false},"2026-11-13")[1].complete,false);
});
test("partner report is a reported callback, not an actual payment or fulfilled redemption",()=>{
 const {api}=fixture();
 const m={activity_qualified_invites:1};
 const j={activity:[{kind:"offer_started",created_at:"2026-11-12T08:00:00Z"}],partner_reports:[{event_id:"source-123",status:"pending",amount_units:300}]};
 const stages=api.stations(m,j,1,{enabled:true},"2026-11-12");
 assert.equal(stages[3].complete,true);
 assert.equal(stages[4].complete,true);
 assert.equal(stages[5].complete,true);
 assert.match(stages[5].help,/No settlement or cash balance/);
 assert.match(stages[3].help,/not identity verified/);
});
test("source loading failures never claim success",()=>{
 const {nodes,api}=fixture();
 api.render({error:"NETWORK_UNAVAILABLE"});
 assert.equal(nodes.questMapCount.textContent,"—");
 assert.match(nodes.questMap.innerHTML,/No progress is being estimated/);
 assert.match(nodes.questMapFeedback.textContent,/Live activity unavailable/);
});
