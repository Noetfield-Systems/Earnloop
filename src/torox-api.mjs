/**
 * Torox native offer discovery. This is DISTINCT from the hosted wall.
 * Requires Torox API entitlement plus approved publisher placement.
 * https://torox.io/publisher-integration-guide/
 *
 * No external conversion, reward verification, or cash credit is inferred here.
 */
import {toroxBase,toroxConfigured} from './torox.mjs';

const GEO=/^[A-Z]{2}$/;
const CAMPAIGN=/^[1-9][0-9]{0,11}$/;
const SYSTEMS=new Set(['ios','android','web']);
const cache=new Map();

export function toroxApiConfigured(env=process.env){
  return toroxConfigured(env) && env.TOROX_API_ENABLED==='true';
}
export function validateDiscovery(geo,os){
  if(!GEO.test(geo||'') || !SYSTEMS.has(os))throw Error('INVALID_OFFER_ELIGIBILITY_FILTER');
  return {geo,os};
}
function apiUrl(path,env){
  const uri=new URL(path,toroxBase(env));
  uri.searchParams.set('source_id',env.TOROX_PLACEMENT_ID);
  uri.searchParams.set('token',env.TOROX_APP_TOKEN);
  return uri;
}
async function json(uri,fetcher){
  const response=await fetcher(uri,{redirect:'error',headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('PARTNER_API_UNAVAILABLE');
  return response.json();
}
function sanitizeOffer(offer){
  const id=String(offer?.offerId??'');
  if(!CAMPAIGN.test(id) || typeof offer?.name!=='string'||!offer.name.trim())return null;
  const reward=Number(offer.amount);
  const events=Array.isArray(offer.events)?offer.events.slice(0,30).map(e=>({
    name:typeof e?.eventName==='string'?e.eventName.slice(0,100):'Milestone',
    reward_units:Number.isFinite(Number(e?.amount))&&Number(e.amount)>=0?Number(e.amount):null
  })):[];
  return {
    campaign_id:id,name:offer.name.slice(0,140),
    description:typeof offer.description==='string'?offer.description.slice(0,500):'Review requirements on the partner offer.',
    os:typeof offer.os==='string'?offer.os:null,
    reward_units:Number.isFinite(reward)&&reward>=0?reward:null,
    reward_unit_label:'provider-configured reward units',
    category:Array.isArray(offer.verticalNames)?offer.verticalNames.slice(0,3).filter(x=>typeof x==='string').map(x=>x.slice(0,40)):[],
    milestones:events,provider:'torox',attribution_state:'not_started',
    verification_state:'not_earned'
  };
}
export async function listToroxOffers({geo,os,env=process.env,fetcher=fetch,now=Date.now()}){
  if(!toroxApiConfigured(env))throw Error('TOROX_API_NOT_APPROVED');
  validateDiscovery(geo,os);
  const k=env.TOROX_MODE+':'+env.TOROX_PLACEMENT_ID+':'+geo+':'+os;
  const existing=cache.get(k);
  if(existing && existing.expires>now)return existing.payload;
  const uri=apiUrl('/partner/campaigns',env);
  uri.searchParams.set('goals','all');
  uri.searchParams.set('geo',geo);
  uri.searchParams.set('os',os);
  const result=await json(uri,fetcher);
  if(!Array.isArray(result))throw Error('INVALID_PARTNER_INVENTORY');
  const offers=result.slice(0,160).map(sanitizeOffer).filter(Boolean).slice(0,36);
  const payload={provider:'torox',geo,os,offers,inventory_uncertain:result.length===0,
    source:'partner_api',payouts_enabled:false,cash_rewards_verified:false};
  if(cache.size>200)cache.clear();
  cache.set(k,{expires:now+120000,payload});
  return payload;
}
export async function createToroxOfferClick(memberId,{geo,campaignId,env=process.env,fetcher=fetch}={}){
  if(!toroxApiConfigured(env))throw Error('TOROX_API_NOT_APPROVED');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId||''))throw Error('INVALID_MEMBER');
  if(!GEO.test(geo||'')||!CAMPAIGN.test(String(campaignId||'')))throw Error('INVALID_OFFER_CLICK');
  const uri=apiUrl('/partner/user/click',env);
  uri.searchParams.set('uid',memberId);
  uri.searchParams.set('geo',geo);
  uri.searchParams.set('campaign_id',String(campaignId));
  const result=await json(uri,fetcher);
  if(result?.ok!==true||typeof result.clickUrl!=='string')throw Error('PARTNER_CLICK_UNAVAILABLE');
  const url=new URL(result.clickUrl);
  if(url.protocol!=='https:'||!(url.hostname==='torox.io'||url.hostname.endsWith('.torox.io'))
      ||url.username||url.password)throw Error('PARTNER_CLICK_ORIGIN_REJECTED');
  return url.toString();
}
