const $=id=>document.getElementById(id);
let auth='',state=null,view='overview';
const screenTitles={overview:['Operating the earning loop.','Live operations, commercial reality and proof-first execution.'],
transactions:['Every conversion. Every cost.','Reported revenue is not collected cash. Missing costs leave contribution unconfirmed.'],
providers:['Supply is the unlock.','Publisher onboarding, technical integration and actual approval evidence.'],
members:['Real members, qualified actions.','Signup and participation are observable; identity and payout eligibility are separate.'],
offers:['Publish only legitimate offers.','Every listing requires a real source, destination and approval reference before visibility.'],
redemptions:['Requests without fictional balances.','Capture interest, review eligibility and close requests. No payment execution is enabled.'],
trust:['Trust is transaction-level.','Track anomalies, source evidence, duplicates, reversals and unverified claims.'],
support:['Resolve the human loop.','Member support cases and sponsor inquiries from the live database.'],
experiments:['Four tracks. One profit target.','A: offerwall · B: sponsor quest · C: affiliate · D: merchant credit.'],
company:['Existing Company OS.','Use the canonical work registry and receipt engine, not a duplicate automation stack.']};
const roles={growth:'members',partnerships:'providers',trust:'trust',revenue:'transactions',engineering:'company',verifier:'trust'};
function n(tag,value,cls){const x=document.createElement(tag);if(value!==undefined&&value!==null)x.textContent=String(value);if(cls)x.className=cls;return x;}
function add(p,...kids){kids.forEach(x=>{if(x!=null)p.append(x)});return p;}
function empty(msg){return n('div',msg,'empty');}
function paragraph(msg){return n('p',msg,'muted');}
function pill(v){const x=n('span',v,'status');const s=String(v).toLowerCase();x.classList.add(/approved|configured|completed|resolved|operator_published|activity_qualified/.test(s)?'good':/reversed|blocked|failed|risk|rejected|closed_unfunded/.test(s)?'bad':'warn');return x;}
function wrap(){return n('div',null,'tabs-panel');}
function heading(title,detail){return add(n('div',null,'section-head'),n('h2',title),n('span',detail||''));}
function section(title,details,child){const x=wrap();add(x,heading(title,details),child);return x;}
function panel(title,description){const x=n('div',null,'panel');if(title)x.append(n('h3',title));if(description)x.append(paragraph(description));return x;}
function fmt(n,currency){return n===null||n===undefined?'—':currency?new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(Number(n)/100):Number(n).toLocaleString('en-CA');}
function d(t){return t?new Date(t).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';}
function short(s){return String(s||'').slice(0,18);}
function table(columns,rows){if(!rows?.length)return empty('No real records in this category yet. Activity will appear here when it occurs.');
 const frame=n('div',null,'table-wrap'),tb=n('table'),head=n('thead'),tr=n('tr');columns.forEach(x=>tr.append(n('th',x)));head.append(tr);tb.append(head);
 const body=n('tbody');
 for(const row of rows){const r=n('tr');for(const v of row){const c=n('td');if(v?.nodeType)c.append(v);else c.textContent=v===null||v===undefined?'—':String(v);r.append(c);}body.append(r);}
 tb.append(body);frame.append(tb);return frame;}
function kpi(name,number,detail){const x=n('div',null,'kpi');add(x,n('span',name,'label'),n('strong',number),n('small',detail));return x;}
function fieldsForm(title,description,fields,action,buttonText='Record action'){
 const p=panel(title,description),f=n('form',null,'form-grid');for(const def of fields){
  const w=n('div',null,def.span||'');const id='f-'+action+'-'+def.name,lab=n('label',def.label);lab.htmlFor=id;
  let control;if(def.type==='select'){control=n('select');for(const option of def.options){const o=n('option',option.label||option.value);o.value=option.value;control.append(o);}}
  else if(def.type==='textarea'){control=n('textarea');control.rows=3;} else{control=n('input');control.type=def.type||'text';}
  control.id=id;control.name=def.name;control.placeholder=def.placeholder||'';control.required=def.required!==false;if(def.value!=null)control.value=def.value;
  if(def.type==='number'){control.min='0';control.step='1';}add(w,lab,control);f.append(w);
 }
 const b=n('button',buttonText,'primary');b.type='submit';f.append(b);
 f.addEventListener('submit',async ev=>{ev.preventDefault();const form=new FormData(f),v={action};for(const def of fields){
 let value=form.get(def.name);if(def.type==='number')value=value===''?null:Number(value);if(value!=='')v[def.name]=value;
 }b.disabled=true;try{await request('/api/company-os/operations','POST',v);$('feedback').textContent='Saved to Earnloop PostgreSQL. Manual evidence remains operator-reported.';f.reset();await refresh();}catch(e){$('feedback').textContent='Action not saved: '+e.message;}finally{b.disabled=false;}});
 p.append(f);return p;
}
const I={track:[{label:'Track A · offerwall',value:'A'},{label:'Track B · sponsor quest',value:'B'},{label:'Track C · affiliate',value:'C'},{label:'Track D · merchant credit',value:'D'}],
 stage:[{value:'not_started'},{value:'applied'},{value:'response_received'},{value:'contract_reported'},{value:'blocked'}],
 evidence:[{value:'provider_report'},{value:'approval'},{value:'reversal'},{value:'remittance'},{value:'bank_receipt'},{value:'fulfillment'},{value:'dispute'},{value:'failure'},{value:'other'}],
 charge:[{value:'provider_share'},{value:'user_reward'},{value:'referral'},{value:'processing'},{value:'fulfillment'},{value:'acquisition'},{value:'reversal'},{value:'support'}]};
async function request(path,method='GET',value){const r=await fetch(path,{method,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:value?JSON.stringify(value):undefined,cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j;}
async function refresh(){if(!auth)return;const [ops,company,commercial]=await Promise.all([request('/api/company-os/operations'),request('/api/company-os/overview'),request('/api/company-os/commercial')]);state={...ops,company,commercial};$('asof').textContent='Live readback · '+d(new Date());$('conn-state').textContent='Authenticated / live database';$('api-dot').classList.add('connected');$('auth').classList.add('hidden');render();}
function connect(){auth=$('token').value;$('token').value='';if(!auth){$('feedback').textContent='Enter the existing administrator token.';return;}refresh().then(()=>$('feedback').textContent='').catch(e=>{$('feedback').textContent='Unable to authenticate: '+e.message;$('auth').classList.remove('hidden');auth='';});}
$('connect').addEventListener('click',connect);$('token').addEventListener('keydown',e=>{if(e.key==='Enter')connect()});
$('refresh').addEventListener('click',()=>refresh().catch(e=>$('feedback').textContent='Refresh failed: '+e.message));
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render();}));
$('role').addEventListener('change',()=>{const r=$('role').value;if(roles[r])view=roles[r];render();});
function render(){const [title,sub]=screenTitles[view];$('headline').replaceChildren(n('span',title.slice(0,-1)),n('span','.', 'accent'));$('subhead').textContent=sub;$('crumb').textContent='/ '+view.toUpperCase();document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 if(!state)return;
 const holder=$('content');holder.replaceChildren();
 const routes={overview:overview,transactions:transactions,providers:providers,members:members,offers:offers,redemptions:redemptions,trust:trust,support:support,experiments:experiments,company:company};
 holder.append(routes[view]());}
function overview(){
 const x=wrap(),c=state.counts,k=state.company?.kpis||{};
 const stats=n('div',null,'kpis');
 add(stats,kpi('Real member accounts',fmt(k.members??c.members),'PostgreSQL source of truth'),
 kpi('Provider-reported conversions',fmt(k.reported_events??c.source_reported_transactions),'Not settled cash'),
 kpi('Independently verified conversions',0,'No external reconciliation connector'),
 kpi('Verified positive-margin transactions',0,'First transaction proof still open'));
 x.append(stats);
 const proof=n('div',null,'three-col');
 for(const [name,description] of [
  ['01 / Supply approved','Partner contract / permission and an attributable approved real offer.'],
  ['02 / Cash reconciled','Source callback + remittance + bank settlement independently matched.'],
  ['03 / Positive contribution','Known actual reward, provider, referral, processing, acquisition and fulfillment costs.']]){
  const card=n('div',null,'proof-card');add(card,pill('NOT YET VERIFIED'),n('strong',name),paragraph(description));proof.append(card);
 }
 x.append(section('First positive-margin transaction · proof board','Not accomplished / no synthetic proof',proof));
 const cols=n('div',null,'two-col'),growth=panel('User activation & retention','Based on actual signup, member activity and existing Company OS metrics.');
 const kv=n('div',null,'mini-grid');
 for(const [t,v] of [['Qualified by activity',c.qualifying_activity],['Verified identity',c.verified_members],['Reported reversals',c.reported_reversals],['Failure reports',c.reported_failures],['Open redemption interests',c.redemption_requests],['Verified payouts',c.verified_payouts]])add(kv,n('div',t+' · '+v,'item'));
 growth.append(kv);
 const com=panel('Commercial and provider next actions','Real partner onboarding evidence and work packet states.');
 const list=n('div',null,'mini-grid');for(const p of state.providers){list.append(n('div',p.name+' · '+p.technical_status+' · '+p.onboarding_status,'item'));}
 com.append(list);add(cols,growth,com);x.append(section('Operations at a glance','Observed records only',cols));
 const act=panel('Founder → Company OS automation','Operate offers, partner notes, member issues and evidence manually first. Company OS can create and execute supported bounded WorkPackets, with receipts in its existing registry. Automatic financial execution remains disabled.');
 act.append(n('div','Stage 1 · Manual intake → Stage 2 · Postback dedupe + review → Stage 3 · Independent cash/fulfillment reconciliation → Stage 4 · Scheduled Company OS workflows','note'));
 x.append(section('Execution path','One canonical Company OS',act));return x;
}
function transactions(){
 const x=wrap();
 x.append(n('div','Revenue figures below are provider/source-reported, not bank collections. A provisional margin is shown only if every cost component is recorded. It is not verified profit.','note'));
 x.append(section('Conversion & transaction register',state.transactions.length+' retrieved source records',
 table(['Provider / external ID','Member','Event state','Source payout / gross','Provider share','User reward','Other costs','Payment / fulfillment','Contribution','Proof'],state.transactions.map(t=>[
 n('span',t.provider+' / '+short(t.event_id),'mono'),short(t.member_id),pill(t.source_state),
 fmt(t.gross_minor,t.currency),fmt(t.economics.expenses.provider_share,t.currency),
 fmt(t.economics.expenses.user_reward,t.currency),
 t.economics.missing_costs.length+' cost fields missing', 'Cash unverified / not fulfilled',
 t.economics.contribution_minor===null?'Not calculable':fmt(t.economics.contribution_minor,t.currency)+' provisional',
 pill(t.proof)]))));
 const two=n('div',null,'two-col');
 two.append(fieldsForm('Record actual transaction cost','Source URL required. Costs cannot become verified cash through manual entry.',[
 {name:'provider',label:'Provider',placeholder:'torox'}, {name:'event_id',label:'Provider event ID'},
 {name:'kind',label:'Expense type',type:'select',options:I.charge},
 {name:'amount_minor',label:'Cost in minor units',type:'number'},
 {name:'currency',label:'Currency',type:'select',options:[{value:'USD'},{value:'CAD'}]},
 {name:'source_url',label:'Actual cost evidence · HTTPS',type:'url',span:'span3'}],'cost','Record reported cost'));
 two.append(fieldsForm('Attach independent-source reference','A URL can point to a real remittance/bank document; it will remain operator-reported until independently reconciled.',[
 {name:'provider',label:'Provider'},{name:'event_id',label:'Event ID'},
 {name:'kind',label:'Evidence kind',type:'select',options:I.evidence},
 {name:'source_url',label:'Actual evidence URL',type:'url',span:'span3'}],'evidence','Attach source reference'));
 x.append(section('Reconciliation intake','Controlled, append-only evidence',two));
 x.append(section('Source-reported reward ledger','Not spendable; no funded balance exists',
 table(['Provider / event','Member','Ledger event','Reported amount / unit','Availability'],(state.reward_ledger||[]).map(a=>[
 a.provider+' / '+short(a.event_id),short(a.member_id),a.kind,a.amount+' '+a.currency,pill('unfunded / unverified')]))));
 x.append(section('Financial journal','Actual operator-reported rows; not bank-verified',
 table(['Provider','External ID','Kind','Amount','Classification'],state.finance.map(a=>[a.provider,short(a.external_id),a.kind,fmt(a.amount_minor,a.currency),pill(a.classification)]))));
 return x;
}
function providers(){
 const x=wrap();
 const tb=table(['Provider','Technical connection','Onboarding report','Acceptance evidence'],state.providers.map(p=>[
 p.name,pill(p.technical_status),pill(p.onboarding_status),
 p.approval_reported_reference?link(p.approval_reported_reference,'View reported source'):'No source attached']));
 x.append(section('Provider supply register','Credentials checked server-side',tb));
 x.append(n('div','Provider note ≠ publisher approval. Technical status comes only from real server configuration. Torox is the primary; BitLabs and ayeT remain alternatives. Tremendous handles future funded fulfillment.','note'));
 x.append(fieldsForm('Update onboarding from real evidence','Partner outreach and contacts remain in the existing Company OS commercial outbox.',[
 {name:'provider',label:'Provider',type:'select',options:['torox','bitlabs','ayet','tremendous'].map(value=>({value}))},
 {name:'stage',label:'Operator-reported stage',type:'select',options:I.stage},
 {name:'source_url',label:'Real reply/portal source',type:'url'},
 {name:'notes',label:'Exact partner status and next action',type:'textarea',span:'span3'}],'provider_note','Record onboarding update'));
 x.append(section('Existing commercial dispatch','Source-linked, founder-approved messages',
 table(['Partner','Current state','Channel','Follow-up'],state.commercial.targets.map(t=>[
 t.partner,pill(t.state),t.channel,t.follow_up_due?'Due':'Not due / not sent']))));
 return x;
}
function link(url,label){const x=n('a',label);x.href=url;x.rel='noopener noreferrer';x.target='_blank';return x;}
function members(){
 const x=wrap();
 x.append(section('Member qualification',state.members.length+' recent members in readback',
 table(['Member','Joined','XP / noncash','Observed engagement','Qualification','Identity status'],state.members.map(m=>[
 'Explorer '+short(m.code),d(m.created_at),fmt(m.xp),m.activity_events+' events · '+m.checkins+' check-ins',
 pill(m.qualification),pill('identity unverified')]))));
 x.append(n('div','Signup, daily check-ins and challenge activity demonstrate behavior—not human uniqueness, geographic eligibility or payment-account ownership. Duplicate incentives and payout eligibility require independent verification.','note'));
 x.append(section('Actual member conversion funnel','Live counts',
 table(['Stage','Actual observed total','Evidence boundary'],[
 ['Joined',state.company.kpis.members,'Member database'],['Activated',state.company.kpis.activated,'Noncash activity'],
 ['Identity verified',0,'Independent identity check absent'],['Provider-funded payout verified',0,'Payout rails disabled']])));
 return x;
}
function offers(){
 const x=wrap();
 x.append(section('Offer and campaign inventory',state.offers.length+' configured',
 table(['Offer','Track','Provider','State','Source / terms'],state.offers.map(o=>[
 o.title,pill('Track '+o.track),o.provider,pill(o.state),
 o.source_reference?link(o.source_reference,'Source evidence'):'No source']))));
 x.append(fieldsForm('Create a real-source offer draft','Drafts are private; no partner inventory is invented. Publish only after acceptance and actual terms.',[
 {name:'track',label:'Track',type:'select',options:I.track},
 {name:'title',label:'Offer title',placeholder:'Real offer or sponsor campaign'},
 {name:'provider',label:'Source / sponsor'},
 {name:'description',label:'Eligibility, action and completion rules',type:'textarea',span:'span3'},
 {name:'source_reference',label:'Offer terms / official campaign source',type:'url',span:'span2'},
 {name:'destination_url',label:'Approved outbound URL',type:'url',required:false},
 {name:'reward_minor',label:'Disclosed reward amount · minor units',type:'number',required:false},
 {name:'reward_currency',label:'Reward currency',type:'select',options:[{value:'USD'},{value:'CAD'}],required:false}
 ],'offer_create','Save private offer draft'));
 x.append(fieldsForm('Publish / pause an existing offer','Operator-published is not independently partner-verified. Approved destination and real approval document required.',[
 {name:'id',label:'Offer UUID',placeholder:'Existing offer UUID',span:'span2'},
 {name:'state',label:'Next state',type:'select',options:[{value:'operator_published'},{value:'paused'},{value:'draft'}]},
 {name:'approval_reference',label:'Actual approval / contracted terms URL',type:'url',span:'span3',required:false}
 ],'offer_state','Update visibility'));
 x.append(section('Member-side discovery','Connected to this same inventory',link('/earn','Open member earn / offers page ↗')));
 return x;
}
function redemptions(){
 const x=wrap();x.append(n('div','Cash payout execution is OFF. Requests here record interest only and are not a payable wallet balance. Never mark them as paid without actual funding and fulfillment integration.','note'));
 x.append(section('Actual redemption request queue',state.redemptions.length+' actual requests',
 table(['Request','Member','Asked amount','Method','Review state'],state.redemptions.map(r=>[
 short(r.id),short(r.member_code),fmt(r.amount_minor,r.currency),r.method,pill(r.state)]))));
 x.append(fieldsForm('Review a request','No action here can transfer funds or mint an available balance.',[
 {name:'id',label:'Request UUID',span:'span2'},
 {name:'state',label:'Review decision',type:'select',options:[{value:'in_review'},{value:'closed_unfunded'},{value:'interest_unfunded'}]}
 ],'redemption_state','Save triage'));
 return x;
}
function trust(){
 const x=wrap();
 x.append(section('Risk review',state.risk_flags.length+' velocity flags',
 table(['Interaction','Member','Event','Flag','When'],state.risk_flags.map(v=>[
 short(v.id),short(v.member_id),v.event_type,pill(v.flag),d(v.created_at)]))));
 x.append(section('Recorded user interactions',state.interactions.length+' events in readback',
 table(['Interaction','Member','Offer','Event','Dedup / risk'],state.interactions.map(v=>[
 short(v.id),short(v.member_id),short(v.offer_id),v.event_type,pill(v.flag||'not flagged')]))));
 x.append(section('Evidence classification',state.evidence.length+' attached source URLs',
 table(['Provider / event','Evidence type','Reference','Classification'],state.evidence.map(e=>[
 e.provider+' / '+short(e.event_id),e.kind,link(e.source_url,'Open source'),pill(e.classification)]))));
 x.append(fieldsForm('Attach event or dispute evidence','Manual attachments cannot be marked independently verified.',[
 {name:'provider',label:'Provider'}, {name:'event_id',label:'Event ID'},
 {name:'kind',label:'Evidence type',type:'select',options:I.evidence},
 {name:'source_url',label:'Actual reference URL · HTTPS',type:'url',span:'span3'}
 ],'evidence','Record evidence'));
 x.append(n('div','Duplicate member interactions are idempotent. Provider event IDs are unique in the existing partner and Torox tables. High-frequency member actions are flagged for review, but no automatic financial reward is issued.','note'));
 return x;
}
function support(){
 const x=wrap();
 x.append(section('Member support cases',state.support.length+' real cases',
 table(['Case ID','Subject','Opened','Status'],state.support.map(c=>[short(c.id),c.subject,d(c.created_at),pill(c.state)]))));
 x.append(fieldsForm('Progress a member case','Operator state change is audit-logged.',[
 {name:'id',label:'Case UUID',span:'span2'},
 {name:'state',label:'Next state',type:'select',options:[{value:'open'},{value:'in_review'},{value:'resolved'}]}
 ],'support_state','Save case update'));
 x.append(section('Sponsor inquiries',state.sponsor_leads.length+' real inquiries',
 table(['Lead ID','Email','Brief','State'],state.sponsor_leads.map(c=>[short(c.id),c.email,c.brief,pill(c.state)]))));
 x.append(fieldsForm('Update sponsor pipeline','The inquiry itself does not prove a sponsor purchase.',[
 {name:'id',label:'Sponsor lead UUID',span:'span2'},
 {name:'state',label:'Next state',type:'select',options:[{value:'new'},{value:'contacted'},{value:'closed'}]}
 ],'sponsor_state','Update sponsor lead'));
 return x;
}
function experiments(){
 const x=wrap(),cards=n('div',null,'two-col');
 for(const ex of state.experiments){
  const card=panel('TRACK '+ex.track+' / '+ex.objective,'Owner: '+ex.owner+' · Updated '+d(ex.updated_at));
  card.append(pill(ex.state));
  card.append(paragraph({
   A:'Torox primary, alternatives only with authentic publisher approval.',
   B:'Fixed-price sponsor quest with real campaign acceptance and attributed event evidence.',
   C:'Affiliate placement with source-confirmed terms, eligibility and click attribution.',
   D:'Merchant-credit experiment: no fabricated gift cards or unfunded claims.'
  }[ex.track]));
  cards.append(card);
 }
 x.append(section('Commercial experiments','Zero synthetic revenue or traffic claims',cards));
 x.append(fieldsForm('Move experiment through a real milestone','Attach source evidence whenever advancing a track.',[
 {name:'track',label:'Track',type:'select',options:I.track},
 {name:'state',label:'Execution state',type:'select',options:[{value:'planned'},{value:'running'},{value:'paused'},{value:'completed'}]},
 {name:'source_url',label:'Milestone reference',type:'url',required:false,span:'span3'}
 ],'experiment','Update track status'));
 x.append(section('Measured results by track','Reported conversions, not bank-verified profit',
 table(['Track','Configured offers','Observed clicks','Reported conversions','Verified profit'],Object.keys({A:1,B:1,C:1,D:1}).map(t=>[
 t,state.offers.filter(o=>o.track===t).length,state.interactions.filter(i=>state.offers.some(o=>o.id===i.offer_id&&o.track===t&&i.event_type==='click')).length,
 'Not attributed / unverified',fmt(0,'USD')+' verified']))));
 return x;
}
function company(){
 const x=wrap();
 x.append(section('Canonical work packet registry',state.work.length+' recent WorkPackets',
 table(['Work type','Owner','Authority','State','Created'],state.work.map(w=>[
 w.type,w.owner,w.authority,pill(w.state),d(w.created_at)]))));
 const p=panel('Dispatch into existing Company OS','This creates a real typed WorkPacket in the existing execution engine; no parallel jobs service.');
 const f=n('form',null,'form-grid'),names=[
 ['snapshot_metrics','Revenue / snapshot real KPIs'],
 ['audit_partner_events','Trust / inspect provider events'],
 ['growth_diagnosis','Growth / activation analysis'],
 ['replication_launch_check','Revenue / copy-first execution decision'],
 ['draft_partner_outreach','Partnerships / draft outreach']];
 const w=n('div'),sel=n('select');sel.name='type';for(const [v,t] of names){const o=n('option',t);o.value=v;sel.append(o);}w.append(n('label','WORKPACKET TYPE'),sel);f.append(w);
 const q=n('div',null,'span2'),objective=n('textarea');objective.required=true;objective.minLength=8;objective.value='Inspect actual Earnloop evidence and advance verified positive-margin transaction';add(q,n('label','OBJECTIVE'),objective);f.append(q);
 const b=n('button','Create WorkPacket','primary');b.type='submit';f.append(b);
 f.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;try{
  const r=await request('/api/company-os/work','POST',{type:sel.value,objective:objective.value,idempotency_key:'ops:'+Date.now()+':'+Math.random().toString(36).slice(2,9)});
  $('feedback').textContent='WorkPacket '+r.work.id+' created in existing Company OS. State: '+r.work.state;await refresh();
 }catch(err){$('feedback').textContent=err.message;}finally{b.disabled=false;}});
 p.append(f);
 const run=n('button','Execute next permitted WorkPacket','action');run.type='button';run.addEventListener('click',async()=>{run.disabled=true;try{
 const v=await request('/api/company-os/run','POST');$('feedback').textContent=v.execution?'Executed '+v.execution.id+' · '+v.execution.state:'No queued authorized work';await refresh();
 }catch(err){$('feedback').textContent=err.message;}finally{run.disabled=false;}});p.append(run);
 x.append(section('Dispatch & run','Company OS service / current registry',p));
 const rec=table(['Work receipt','Verifier classification','Result hash'],(state.company.receipts||[]).map(r=>[short(r.work_id),pill(r.verification),n('span',short(r.result_hash),'mono')]));
 x.append(section('Actual execution receipts','Not cash-revenue proof',rec));
 return x;
}
render();