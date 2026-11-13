import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

async function visit(ref,member){
  const nodes=new Map();
  const get=id=>{
    if(!nodes.has(id))nodes.set(id,{id,hidden:true,disabled:false,textContent:'',value:'',listeners:{},
      addEventListener(type,fn){this.listeners[type]=fn;},
      replaceChildren(){this.children=[];},append(item){(this.children||=[]).push(item);}});
    return nodes.get(id);
  };
  const document={getElementById:get,createElement:()=>({className:'',textContent:''}),
    dispatchEvent:()=>{}};
  const payloads={
    '/api/stats':{members:1,early_access:0},
    '/api/me':{member},
    '/api/leaderboard':{leaders:[]},
    '/api/offerwall/status':{enabled:false}
  };
  const location={href:'https://earnloop.example/?ref='+ref,origin:'https://earnloop.example'};
  const context={document,location,URL,navigator:{},CustomEvent:class{constructor(){}},
    fetch:async path=>({ok:true,json:async()=>payloads[path]})};
  context.window=context;
  runInNewContext(app,context);
  await new Promise(resolve=>setImmediate(resolve));
  return get('inviteLanding');
}
test('invitation entry is honest before and after real session attribution',async()=>{
  const raw=await visit('012345abcdef',null);
  assert.equal(raw.hidden,false);
  assert.match(raw.textContent,/link was detected/);
  assert.match(raw.textContent,/no referral reward is promised/);
  const joined=await visit('012345abcdef',{code:'abcdef123456',xp:0,invited_by_member:true});
  assert.equal(joined.hidden,false);
  assert.match(joined.textContent,/joined through a member invitation/);
  assert.match(joined.textContent,/non-cash/);
  const already=await visit('012345abcdef',{code:'abcdef123456',xp:0,invited_by_member:false});
  assert.equal(already.hidden,true);
  const malformed=await visit('bad-ref',null);
  assert.equal(malformed.hidden,true);
});
test('actual Postgres referrer relation determines attribution; invitee only gets noncash status',()=>{
  assert.match(server,/SELECT id,code,xp,last_checkin,checkin_streak,created_at,referrer_id FROM earnloop_members/);
  assert.match(server,/invited_by_member:!!m\.referrer_id/);
  assert.match(server,/via_invite:!!par\.rows\[0\]\?\.id/);
  assert.match(server,/referrer_id\) VALUES/);
  assert.ok(html.includes('id="inviteLanding"'));
  assert.ok(!html.includes('Guaranteed referral reward'));
});

test('inbound ref survives homepage → earn path without inventing attribution',()=>{
  const link={href:'/earn',getAttribute(k){return this[k];},setAttribute(k,v){this[k]=v;}};
  const get=()=>({addEventListener(){},replaceChildren(){},append(){},textContent:''});
  const context={URL,location:{href:'https://earnloop.example/?ref=012345abcdef&utm_source=telegram',
     origin:'https://earnloop.example'},document:{getElementById:get,
     querySelectorAll:()=>[link],createElement:()=>({})},
     fetch:async path=>({ok:true,json:async()=>({
       '/api/stats':{members:0,early_access:0},
       '/api/me':{member:null},'/api/leaderboard':{leaders:[]},
       '/api/offerwall/status':{enabled:false}}[path])}),
     navigator:{},CustomEvent:class{}};
  context.window=context;
  runInNewContext(app,context);
  assert.equal(link.href,'/earn?ref=012345abcdef&utm_source=telegram');
});
test('earn page uses original referral for both membership and native offer',()=>{
  const earn=readFileSync(new URL('../public/earn.js',import.meta.url),'utf8');
  const match=earn.match(/function signupAttribution\(defaultSource='earn'\)\{[\s\S]*?\n\}/);
  assert.ok(match,'earn page must preserve a validated referral');
  const getContext=(search)=>{
    const context={URL,location:{href:'https://earnloop.example/earn'+search}};
    return runInNewContext(match[0]+'; signupAttribution("native-offer")',context);
  };
  const result=getContext('?ref=ABCDEF012345&utm_source=discord');
  assert.equal(result.ref,'abcdef012345');
  assert.equal(result.source,'discord');
  const bad=getContext('?ref=malicious-%%&utm_source=%3Cscript%3E');
  assert.equal(bad.ref,undefined);
  assert.equal(bad.source,'native-offer');
  assert.match(earn,/api\('\/api\/start','POST',signupAttribution\(\)\)/);
  assert.match(earn,/api\('\/api\/start','POST',signupAttribution\('native-offer'\)\)/);
});
