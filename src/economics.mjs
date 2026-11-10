import crypto from 'node:crypto';
export const MONEY_STATES=['visible','started','provider_reported','verified_payable','cash_collected','reward_funded','fulfilled','reconciled'];
export function minor(value){if(!Number.isSafeInteger(value)||value<0)throw Error('Nonnegative safe integer minor units required');return value;}
export function contribution(t){
 if(!/^[A-Z]{3}$/.test(t.currency||''))throw Error('Explicit ISO currency required');
 const keys=['cleared_revenue','user_rewards','referral_commissions','processing_fees','reversals','acquisition_cost','fulfillment_cost'];
 const v=Object.fromEntries(keys.map(k=>[k,minor(t[k])]));
 const costs=keys.slice(1).reduce((sum,k)=>sum+v[k],0);if(!Number.isSafeInteger(costs))throw Error('Monetary overflow');
 return {currency:t.currency,contribution_minor:v.cleared_revenue-costs,costs_minor:costs,cleared_revenue_minor:v.cleared_revenue};
}
export function transition(current,next,evidence){
 if(next==='reversed')return current!=='reversed'&&!!evidence?.reference;
 if(MONEY_STATES.indexOf(next)!==MONEY_STATES.indexOf(current)+1||!MONEY_STATES.includes(current))return false;
 if(['verified_payable','cash_collected','fulfilled','reconciled'].includes(next))return evidence?.classification==='independently_verified'&&!!evidence.reference;
 if(next==='reward_funded')return evidence?.classification==='independently_verified'&&Number.isSafeInteger(evidence.available_minor)&&Number.isSafeInteger(evidence.reward_minor)&&evidence.reward_minor>0&&evidence.available_minor>=evidence.reward_minor;
 return !!evidence?.reference;
}
export async function setupEconomics(pool){await pool.query(`CREATE TABLE IF NOT EXISTS earnloop_financial_journal(id UUID PRIMARY KEY,external_id TEXT NOT NULL,provider TEXT NOT NULL,member_id UUID REFERENCES earnloop_members(id),kind TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),amount_minor BIGINT NOT NULL CHECK(amount_minor>=0),evidence_reference TEXT NOT NULL,classification TEXT NOT NULL DEFAULT 'operator_reported' CHECK(classification='operator_reported'),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(provider,external_id,kind));`);}
// Manual evidence remains operator-reported. No input field can promote it to bank verification.
export async function recordFinance(pool,v){
 if(!['receivable','cash_receipt','reward_liability','reward_reservation','fulfillment','refund','processing_fee','acquisition_cost','fixed_cost'].includes(v.kind))throw Error('Unsupported journal kind');
 minor(v.amount_minor);if(!/^[A-Z]{3}$/.test(v.currency||'')||!v.external_id||String(v.external_id).length>150||!v.provider||String(v.provider).length>80||!/^https:\/\//.test(v.evidence_reference||'')||v.evidence_reference.length>1000)throw Error('Provider, external identity, currency and evidence URL required');
 const r=await pool.query("INSERT INTO earnloop_financial_journal(id,external_id,provider,member_id,kind,currency,amount_minor,evidence_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id",[crypto.randomUUID(),v.external_id,v.provider,v.member_id||null,v.kind,v.currency,v.amount_minor,v.evidence_reference]);
 return {recorded:!!r.rowCount,classification:'operator_reported',cash_verified:false,payouts_enabled:false};
}
export async function financeOverview(pool){return {journal_totals:(await pool.query('SELECT currency,kind,classification,SUM(amount_minor)::text amount_minor FROM earnloop_financial_journal GROUP BY currency,kind,classification')).rows,verified_cash_minor:null,verified_profit_minor:null,payouts_enabled:false,reason:'Independent remittance, bank and fulfillment reconciliation not connected; journal entries are evidence awaiting review, not verified cash',fixed_costs_known:false};}
