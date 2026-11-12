/**
 * Tremendous production funding and location-specific reward catalog.
 * READ-ONLY. Funding availability is NOT proof of user reward entitlement.
 * No order placement is exposed by this module.
 * https://developers.tremendous.com/reference/get-funding-source
 * https://developers.tremendous.com/reference/list-products
 */
const PROD='https://api.tremendous.com/api/v2/';
const SANDBOX='https://testflight.tremendous.com/api/v2/';
const CURRENCY=/^[A-Z]{3}$/;
const COUNTRY=/^[A-Z]{2}$/;
const ID=/^[A-Za-z0-9_-]{4,64}$/;

export function tremendousConfigured(env=process.env) {
 const mode=env.TREMENDOUS_MODE;
 const key=env.TREMENDOUS_API_KEY;
 return ((mode==='production'&&typeof key==='string'&&key.startsWith('PROD_')&&key.length>12) ||
         (mode==='sandbox'&&typeof key==='string'&&key.startsWith('TEST_')&&key.length>12));
}

export function tremendousMode(env=process.env) {
 return env.TREMENDOUS_MODE==='production'?'production':'sandbox';
}

async function getJSON(endpoint,{env,fetcher}) {
 if(!tremendousConfigured(env))throw Error('TREMENDOUS_CREDENTIALS_NOT_CONFIGURED');
 const uri=new URL(endpoint,tremendousMode(env)==='production'?PROD:SANDBOX);
 const response=await fetcher(uri,{
  method:'GET',redirect:'error',
  headers:{authorization:'Bearer '+env.TREMENDOUS_API_KEY,accept:'application/json'},
  signal:AbortSignal.timeout(8000)
 });
 if(!response?.ok)throw Error('TREMENDOUS_UPSTREAM_UNAVAILABLE');
 return response.json();
}

export function fundingReadiness(source,mode) {
 if(!['production','sandbox'].includes(mode))throw Error('INVALID_TREMENDOUS_MODE');
 if(!source || source.method!=='balance')throw Error('TREMENDOUS_BALANCE_UNAVAILABLE');
 const cents=source.meta?.available_cents;
 const currency=source.meta?.currency_code;
 const usable=source.status==='active' && Array.isArray(source.usage_permissions)
  && source.usage_permissions.includes('api_orders');
 const available=Number.isSafeInteger(cents)&&cents>=0?cents:null;
 return {
  provider:'tremendous',mode,
  source:'GET /funding_sources/BALANCE',
  classification:mode==='production'?'provider_reported_production':'sandbox_only',
  currency:CURRENCY.test(currency||'')?currency:null,
  available_minor:available,
  pending_minor:Number.isSafeInteger(source.meta?.pending_cents)&&source.meta.pending_cents>=0
   ?source.meta.pending_cents:null,
  api_orders_allowed:usable,
  source_funding_sufficient_for_any_order:usable&&available>0,
  real_prefunding_observed:mode==='production'&&usable&&available>0,
  cash_collected_for_earnloop_users_verified:false,
  user_reward_liability_verified:false,
  redeemable_balance_minor:null,
  payouts_enabled:false,
  actual_payouts_verified:0,
  reason:'Funding source status is not user entitlement, settled advertiser cash, or completed reward fulfillment.'
 };
}

export async function readTremendousFunding({env=process.env,fetcher=fetch}={}) {
 const json=await getJSON('funding_sources/BALANCE',{env,fetcher});
 return fundingReadiness(json.funding_source,tremendousMode(env));
}

function catalogEntry(product,currency) {
 if(!product || typeof product!=='object' || !ID.test(product.id||'') ||
     typeof product.name!=='string' || !product.name.trim() ||
     !Array.isArray(product.currency_codes)||!product.currency_codes.includes(currency))return null;
 const skus=Array.isArray(product.skus)?product.skus.filter(x=>{
  return (!x.currency_code||x.currency_code===currency)
    && typeof x.min==='number'&&Number.isFinite(x.min)&&x.min>0
    && typeof x.max==='number'&&Number.isFinite(x.max)&&x.max>=x.min;
 }).slice(0,15).map(x=>({min:x.min,max:x.max,currency_code:currency})):[];
 return {id:product.id,name:product.name.slice(0,120),
  category:typeof product.category==='string'?product.category.slice(0,60):null,
  currency,denominations:skus,
  restrictions_require_review:true,payout_enabled:false};
}
export async function readTremendousProducts({country,currency,env=process.env,fetcher=fetch}={}) {
 if(!COUNTRY.test(country||'')||!CURRENCY.test(currency||''))throw Error('INVALID_CATALOG_FILTER');
 const path='products?country='+encodeURIComponent(country)+'&currency='+encodeURIComponent(currency);
 const json=await getJSON(path,{env,fetcher});
 if(!Array.isArray(json.products))throw Error('INVALID_TREMENDOUS_CATALOG');
 return {provider:'tremendous',mode:tremendousMode(env),country,currency,
  products:json.products.slice(0,250).map(p=>catalogEntry(p,currency)).filter(Boolean),
  catalog_eligible_for_automatic_user_payout:false,
  disclosure:'Product visibility is not a funded user reward or a completed payout. Verify country, fees, delivery and product restrictions before fulfilling.'};
}
