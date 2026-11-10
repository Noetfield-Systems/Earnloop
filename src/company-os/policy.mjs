export const ROLES = Object.freeze({
  ceo: 'Portfolio / product strategy, exceptions and final ratification',
  growth: 'Referral acquisition, funnels, retention, experiments',
  revenue: 'Partner inventory, unit economics, net cash',
  partnerships: 'Offerwall publisher applications and merchant supply',
  community: 'Quest quality, member engagement, community culture',
  trust: 'Fraud, reversal, safety and member disputes',
  engineering: 'Availability, integrations, deployments',
  verifier: 'Evidence review and receipt consistency'
});
export const TASKS = Object.freeze({
  discover_opportunities: {role:'ceo',authority:'auto',risk:'read_only',purpose:'Refresh public source evidence and rank executable opportunities'},
  publish_growth_campaign: {role:'growth',authority:'auto',risk:'draft_only',purpose:'Activate founder-authorized noncash seven-day campaign'},
  snapshot_metrics: {role:'revenue', authority:'auto', risk:'read_only', purpose:'Evidence-backed business KPI snapshot'},
  audit_partner_events: {role:'trust', authority:'auto', risk:'read_only', purpose:'Inspect reported/settled/reversed events without paying anyone'},
  growth_diagnosis: {role:'growth', authority:'auto', risk:'read_only', purpose:'Inspect actual activation and referral funnel'},
  replication_launch_check: {role:'revenue',authority:'auto',risk:'read_only',purpose:'Next evidence-backed action from exact source map and publisher gates'},
  draft_partner_outreach: {role:'partnerships',authority:'auto',risk:'draft_only',purpose:'Build outreach draft, never transmit'},
  launch_paid_campaign: {role:'growth',authority:'founder',risk:'spend',purpose:'Requires founder authorization and a separate execution connector'},
  authorize_reward_payout: {role:'revenue',authority:'founder',risk:'money_movement',purpose:'Requires partner settlement and separate regulated payout implementation'}
});
export function validatePacket(p) {
  if (!p || typeof p !== 'object') throw new Error('WorkPacket object required');
  if (!Object.hasOwn(TASKS,p.type)) throw new Error('Unsupported work type');
  if (typeof p.objective !== 'string' || p.objective.trim().length < 8 || p.objective.length > 500) throw new Error('Invalid objective');
  const key=String(p.idempotency_key||'');
  if (!/^[a-zA-Z0-9_.:-]{8,100}$/.test(key)) throw new Error('Invalid idempotency key');
  const spec=TASKS[p.type];
  return {type:p.type, objective:p.objective.trim(), idempotency_key:key, owner:spec.role, authority:spec.authority,risk:spec.risk};
}
export function canRun(packet) {
  return TASKS[packet.type]?.authority==='auto' && ['read_only','draft_only'].includes(TASKS[packet.type].risk);
}

export const OPPORTUNITY_POLICY=Object.freeze({weights:{speed:20,profit:20,capital:15,demand:10,reuse:10,acquisition:10,retention:5,automation:5,simplicity:5},uncertainty_penalty:20,stale_penalty:15,max_evidence_age_days:7,max_action_budget_minor:0});
