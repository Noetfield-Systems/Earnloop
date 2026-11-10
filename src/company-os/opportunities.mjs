import crypto from 'node:crypto';
import {OPPORTUNITY_POLICY} from './policy.mjs';
export const SOURCES = Object.freeze([
 {id:'torox',business_model:'advertiser-funded offers',reference_business:'Freecash',url:'https://torox.io/publisher-integration-guide/',owner:'partnerships',requires:'publisher_acceptance'},
 {id:'bitlabs',business_model:'survey and game offers',reference_business:'Reward XP',url:'https://developer.bitlabs.ai/docs/getting-started',owner:'partnerships',requires:'publisher_acceptance'},
 {id:'ayet',business_model:'game acquisition',reference_business:'LootUp',url:'https://www.ayetstudios.com/openapi/publisher-doc',owner:'partnerships',requires:'publisher_acceptance'},
 {id:'sponsor',business_model:'fixed-fee creative production',reference_business:'direct sponsored content',url:'https://earnloop-web-production.up.railway.app/sponsor',owner:'revenue',requires:'signed_scope_and_payment'},
 {id:'community',business_model:'noncash activation supporting future commerce',reference_business:'Zealy',url:'https://zealy.io/',owner:'growth',requires:null}
]);
export function scoreOpportunity(c, policy=OPPORTUNITY_POLICY, now=Date.now()) {
 const criteria=Object.keys(policy.weights); const missing=criteria.filter(k=>!Number.isFinite(c.scores?.[k]));
 const raw=criteria.reduce((n,k)=>n+Math.max(0,Math.min(1,Number(c.scores?.[k])||0))*policy.weights[k],0);
 const timestamp=Date.parse(c.evidence_timestamp);const stale=!Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>policy.max_evidence_age_days*86400000;
 const penalty=(c.financial_estimates_verified?0:policy.uncertainty_penalty)+(stale?policy.stale_penalty:0)+missing.length*2;
 const blockers=[...(c.blockers||[])];
 if(c.capital_required?.verified===true&&c.capital_required.minor>policy.max_action_budget_minor)blockers.push('budget_exceeded');
 if(c.license_or_api_method==='unknown')blockers.push('reuse_permission_unknown');
 return {score:Math.round(Math.max(0,raw-penalty)*100)/100,raw_score:raw,uncertainty_penalty:penalty,feasible:!blockers.length,blockers,missing,score_basis:'explicit assumptions, not verified profit'};
}
export async function setupOpportunities(pool){await pool.query(`CREATE TABLE IF NOT EXISTS earnloop_os_opportunities(candidate_id TEXT PRIMARY KEY,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS earnloop_os_sources(id BIGSERIAL PRIMARY KEY,source_url TEXT NOT NULL,retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),http_status INT,content_hash TEXT,error TEXT);`);}
export async function discover(pool,{fetcher=fetch,env=process.env}={}) {
 const candidates=[];
 const signals=(await pool.query("SELECT (SELECT COUNT(*)::int FROM earnloop_sponsor_leads WHERE state='new') sponsor_inquiries,(SELECT COUNT(DISTINCT member_id)::int FROM earnloop_activity WHERE created_at>NOW()-INTERVAL '7 days') active_members_7d")).rows[0];
 for(const s of SOURCES){
  let status=null,hash=null,error=null;
  try{const r=await fetcher(s.url,{redirect:'error',signal:AbortSignal.timeout(6000),headers:{'user-agent':'Earnloop/1.0 public-document-check'}});status=r.status;
   if(r.ok){const reader=r.body.getReader();let bytes=0;const h=crypto.createHash('sha256');try{while(bytes<131072){const {done,value}=await reader.read();if(done)break;bytes+=value.length;h.update(value);}}finally{await reader.cancel();}hash=h.digest('hex');}
  }catch(e){error=e.name;}
  await pool.query('INSERT INTO earnloop_os_sources(source_url,http_status,content_hash,error) VALUES($1,$2,$3,$4)',[s.url,status,hash,error]);
  const approved=s.id==='torox'&&env.TOROX_PUBLISHER_APPROVED==='true'&&!!env.TOROX_APPROVAL_REFERENCE;
  const c={candidate_id:s.id,business_model:s.business_model,reference_business:s.reference_business,source_urls:[s.url],evidence_timestamp:hash?new Date().toISOString():null,customer_value:s.id==='sponsor'?'Original campaign creative and a published placement with measured reporting':'Discovery and community participation',who_pays:s.id==='community'?'No current payer':s.id==='sponsor'?'Contracted sponsor':'Approved advertiser via provider',why_they_pay:'Agreed qualified action or delivered creative',payment_trigger:s.requires||'none; noncash only',expected_revenue_per_action:{minor:null,currency:null,verified:false},reward_cost:{minor:null,verified:false},provider_fees:null,acquisition_cost:null,fraud_and_reversal_exposure:'unquantified; contract required',time_to_first_collectible_revenue:null,capital_required:{minor:0,currency:'CAD',verified:false},reusable_source:s.url,license_or_api_method:'independent mechanics or authorized API',geo_eligibility:'Canadian eligibility unconfirmed',operational_complexity:'assumption: low',confidence:hash?'source_retrieved_terms_unconfirmed':'source_unavailable',execution_owner:s.owner,next_workpacket:s.id==='community'?'publish_growth_campaign':'draft_partner_outreach',observed_result:null,decision_state:'candidate',blockers:s.requires&&!approved?[s.requires]:[],scores:{speed:s.id==='sponsor'?.8:.3,profit:.3,capital:.9,demand:.3,reuse:.8,acquisition:.5,retention:.5,automation:.8,simplicity:.8},financial_estimates_verified:false};
  c.observed_result={...signals,measured_at:new Date().toISOString()};if(s.id==='sponsor'&&signals.sponsor_inquiries>0){c.scores.demand=Math.min(1,signals.sponsor_inquiries/5);c.next_workpacket='draft_partner_outreach';}
  c.ranking=scoreOpportunity(c);c.decision_state=c.ranking.feasible?'ready':'external_dependency';
  await pool.query(`INSERT INTO earnloop_os_opportunities(candidate_id,data) VALUES($1,$2) ON CONFLICT(candidate_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,[c.candidate_id,JSON.stringify(c)]);candidates.push(c);
 }
 return {kind:'opportunity_discovery',candidates:candidates.sort((a,b)=>b.ranking.score-a.ranking.score),money_moved:false};
}
export async function opportunityOverview(pool){return (await pool.query('SELECT data,updated_at FROM earnloop_os_opportunities ORDER BY (data->\'ranking\'->>\'score\')::numeric DESC')).rows;}
