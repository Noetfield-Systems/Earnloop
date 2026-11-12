import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const server=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
const pages=['earn-rewards-canada','offerwall-verification'];
test('two non-thin intent-driven educational pages are served, indexable and in sitemap',async()=>{
 for(const path of pages){
  const html=await readFile(new URL('../public/'+path+'.html',import.meta.url),'utf8');
  assert.ok(html.length>3800,'Substantive guide: '+path);
  assert.match(html,/<title>[^<]+<\/title>/);
  assert.match(html,/name="description"/);
  assert.match(html,/name="viewport"/);
  assert.match(html,new RegExp('rel="canonical" href="https://earnloop-web-production\\.up\\.railway\\.app/'+path+'"'));
  assert.ok(server.includes("'/"+path+"':'"+path+".html'"));
  assert.ok(server.includes("'/"+path+"'"));
  assert.match(html,/href="\/earn"/);
 }
});
test('SEO material explains reward reality and offers legitimate next actions',async()=>{
 const canada=await readFile(new URL('../public/earn-rewards-canada.html',import.meta.url),'utf8');
 const verification=await readFile(new URL('../public/offerwall-verification.html',import.meta.url),'utf8');
 assert.match(canada,/not yet available/);
 assert.match(canada,/eligibility/i);
 assert.match(canada,/not.*guaranteed|no earnings are guaranteed/i);
 assert.match(canada,/href="\/#experience"/);
 assert.match(verification,/Provider callback|provider callback/i);
 assert.match(verification,/Missing credit/);
 assert.match(verification,/fulfill/i);
 assert.match(verification,/cash redemption require/i);
});
