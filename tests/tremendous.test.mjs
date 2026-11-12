import test from 'node:test';
import assert from 'node:assert/strict';
import {tremendousConfigured,tremendousMode,fundingReadiness,readTremendousFunding,readTremendousProducts} from '../src/tremendous.mjs';
const production={TREMENDOUS_MODE:'production',TREMENDOUS_API_KEY:'PROD_example_local_test_token'};
const sandbox={TREMENDOUS_MODE:'sandbox',TREMENDOUS_API_KEY:'TEST_example_local_test_token'};
test('rejects cross-environment, absent and placeholder Tremendous credentials',()=>{
 assert.equal(tremendousConfigured({TREMENDOUS_MODE:'production',TREMENDOUS_API_KEY:sandbox.TREMENDOUS_API_KEY}),false);
 assert.equal(tremendousConfigured({TREMENDOUS_MODE:'sandbox',TREMENDOUS_API_KEY:production.TREMENDOUS_API_KEY}),false);
 assert.equal(tremendousConfigured(production),true);
 assert.equal(tremendousMode(production),'production');
 assert.equal(tremendousConfigured({}),false);
});
test('funding lookup uses freshest named balance and never classifies sandbox as real funds',async()=>{
 let seen;
 const fetcher=async(uri,options)=>{
  seen={uri:new URL(uri),options};
  return {ok:true,json:async()=>({funding_source:{method:'balance',status:'active',
    usage_permissions:['api_orders'],meta:{currency_code:'USD',available_cents:10000000,pending_cents:1200}}})};
 };
 const result=await readTremendousFunding({env:sandbox,fetcher});
 assert.equal(seen.uri.origin,'https://testflight.tremendous.com');
 assert.equal(seen.uri.pathname,'/api/v2/funding_sources/BALANCE');
 assert.equal(seen.options.headers.authorization,'Bearer '+sandbox.TREMENDOUS_API_KEY);
 assert.equal(result.classification,'sandbox_only');
 assert.equal(result.real_prefunding_observed,false);
 assert.equal(result.api_orders_allowed,true);
 assert.equal(result.payouts_enabled,false);
 assert.equal(result.available_minor,10000000);
 assert.equal(JSON.stringify(result).includes(sandbox.TREMENDOUS_API_KEY),false);
});
test('read-only production funding readiness remains distinct from verified collected revenue and payable rewards',async()=>{
 const funding={method:'balance',status:'active',usage_permissions:['api_orders'],
  meta:{currency_code:'CAD',available_cents:18500}};
 const r=fundingReadiness(funding,'production');
 assert.equal(r.real_prefunding_observed,true);
 assert.equal(r.user_reward_liability_verified,false);
 assert.equal(r.cash_collected_for_earnloop_users_verified,false);
 assert.equal(r.payouts_enabled,false);
 assert.equal(fundingReadiness({...funding,usage_permissions:[]},'production').source_funding_sufficient_for_any_order,false);
 assert.equal(fundingReadiness({...funding,meta:{available_cents:-5}},'production').available_minor,null);
});
test('country/currency catalog only returns sanitized products and respects partner filters',async()=>{
 let called;
 const fetcher=async(uri,options)=>{
  called={uri:new URL(uri),options};
  return {ok:true,json:async()=>({products:[
   {id:'ABCDEF99',name:'Local gift card',currency_codes:['CAD','USD'],category:'merchant_card',
    skus:[{min:10,max:100,currency_code:'CAD'},{min:5,max:50,currency_code:'USD'}],
    disclosure:'<script>alert(1)</script>'},
   {id:'XYZQQQ22',name:'Wrong currency',currency_codes:['EUR'],skus:[]}]})};
 };
 const r=await readTremendousProducts({country:'CA',currency:'CAD',env:production,fetcher});
 assert.equal(called.uri.origin,'https://api.tremendous.com');
 assert.equal(called.uri.searchParams.get('country'),'CA');
 assert.equal(called.uri.searchParams.get('currency'),'CAD');
 assert.equal(r.products.length,1);
 assert.equal(r.products[0].denominations.length,1);
 assert.equal(r.products[0].denominations[0].min,10);
 assert.equal(r.products[0].disclosure,undefined);
 assert.equal(r.catalog_eligible_for_automatic_user_payout,false);
 assert.equal(JSON.stringify(r).includes(production.TREMENDOUS_API_KEY),false);
 await assert.rejects(readTremendousProducts({country:'Canada',currency:'CAD',env:production,fetcher}),/INVALID_CATALOG_FILTER/);
});
test('provider auth failure and malformed responses are reported as failures, not empty paid catalogs',async()=>{
 await assert.rejects(readTremendousFunding({env:production,fetcher:async()=>({ok:false,status:401})}),/UPSTREAM_UNAVAILABLE/);
 await assert.rejects(readTremendousProducts({country:'CA',currency:'CAD',env:production,
  fetcher:async()=>({ok:true,json:async()=>({products:null})})}),/INVALID_TREMENDOUS_CATALOG/);
});
