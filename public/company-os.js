const $=id=>document.getElementById(id);
let token='';
async function os(path,method='GET',value,founder=false){const headers={authorization:'Bearer '+token,'content-type':'application/json'};if(founder){const secret=$('founderSecret').value;if(!secret)throw Error('Founder approval token required');headers['x-founder-approval-token']=secret;}const res=await fetch('/api/company-os/'+path,{method,headers,body:value?JSON.stringify(value):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data;}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;}
async function show(){try{const d=await os('overview');const m=$('businessMetrics');m.replaceChildren();const items=[['Members',d.kpis.members],['Activated',d.kpis.activated],['Tracked referrals',d.kpis.referrals],['Waitlist',d.kpis.waitlist],['Reported conversions',d.kpis.reported_events],['Settled events',d.kpis.settled_events],['Settled gross (cents)',d.kpis.settled_gross_cents],['Reward liability (cents)',d.kpis.settled_reward_liability_cents]];for(const [label,val] of items){const c=node('div','', 'metric-mini');c.append(node('strong',Number(val||0).toLocaleString('en-CA')),node('small',label));m.append(c);}const w=$('workItems');w.replaceChildren();for(const job of d.work){const item=node('div','', 'work-item');item.append(node('span',job.state.toUpperCase()+' · '+job.owner,'mini-pill'),node('b',job.type),node('span',job.objective));w.append(item);}for(const receipt of d.receipts){const item=node('div','', 'work-item');item.append(node('span',receipt.verification,'mini-pill'),node('code',receipt.result_hash));w.append(item);}if(!d.work.length)w.textContent='No WorkPackets yet.';$('adminStatus').textContent='Authorized. Cash payouts disabled; partner approval is a separate gate.';void showReplication();void showCommercial();}catch(e){$('adminStatus').textContent=e.message;}}
$('unlock').addEventListener('click',()=>{token=$('secret').value; $('secret').value='';show();});
$('workForm').addEventListener('submit',async e=>{e.preventDefault();try{const type=$('workType').value,objective=$('objective').value;const key='operator:'+Date.now()+':'+Math.random().toString(36).slice(2,8);const r=await os('work','POST',{type,objective,idempotency_key:key});$('adminStatus').textContent='WorkPacket '+r.work.id+' created: '+r.work.state;await show();}catch(err){$('adminStatus').textContent=err.message;}});
$('runWork').addEventListener('click',async()=>{try{const r=await os('run','POST');$('adminStatus').textContent=r.execution?'Executed '+r.execution.id+' → '+r.execution.state:'No permitted queued work';await show();}catch(e){$('adminStatus').textContent=e.message;}});

async function showReplication(){try{
 const d=await os('replication');const panel=$('replicationPlan');if(!panel)return;panel.replaceChildren();
 const next=node('p','NEXT · '+d.next_action.owner+' · '+d.next_action.action+' · Evidence: '+d.next_action.evidence);panel.append(next);
 for(const target of d.targets){panel.append(node('p',target.priority+' · '+target.id+' · '+target.method+' · '+target.source+' → '+target.target+' · '+target.state));}
 }catch(e){if($('replicationPlan'))$('replicationPlan').textContent=e.message;}}

function commercialButton(label,handler,disabled=false){
 const b=node('button',label,'button button-outline');b.type='button';b.disabled=disabled;
 b.addEventListener('click',async()=>{b.disabled=true;try{await handler();await showCommercial();}catch(e){$('commercialStatus').textContent=e.message;}finally{b.disabled=false;}});return b;
}
async function showCommercial(){
 const panel=$('commercialTargets');if(!panel)return;
 try{
  const data=await os('commercial');panel.replaceChildren();
  $('commercialStatus').textContent=data.meaning;
  if(!data.founder_approval_token_configured)$('commercialStatus').textContent+=' · Founder approval secret not configured.';
  for(const target of data.targets){
   const section=node('div','','work-item');
   section.append(node('span',target.state.toUpperCase()+' · '+target.channel,'mini-pill'),node('b',target.partner),node('span',target.subject));
   const message=node('pre',target.message);message.style.whiteSpace='pre-wrap';message.style.overflowWrap='anywhere';section.append(message);
   if(target.to_email)section.append(node('small','Recipient: '+target.to_email));
   if(target.portal_url){
    const link=node('a','Official publisher registration ↗');
    link.href=target.portal_url;link.target='_blank';link.rel='noopener noreferrer';section.append(link);
   }
   if(target.dispatch_id)section.append(node('code','Provider email ID: '+target.dispatch_id));
   if(target.follow_up_due)section.append(node('strong','Follow-up due: verify reply before sending anything else'));
   if(target.last_error)section.append(node('small','Delivery review required: '+target.last_error));
   if(target.state==='prepared'&&target.channel==='email'&&target.to_email){
    section.append(commercialButton('Founder: approve exact draft',async()=>{
     const r=await os('commercial/approve','POST',{key:target.key},true);
     $('commercialStatus').textContent='Approved '+r.commercial.key+'. No email sent.';
    }));
   }
   if(target.state==='approved'){
    section.append(commercialButton('Send once via approved email provider',async()=>{
     if(!confirm('Send this exact authorized email to '+target.to_email+'?'))return;
     const r=await os('commercial/send','POST',{key:target.key});
     $('commercialStatus').textContent='Provider accepted email ID '+r.commercial.provider_message_id+'. Delivery and partner approval still unverified.';
    },!target.can_send));
    if(!target.can_send)section.append(node('small','Configure sender, Resend key and recipient allowlist privately in Railway.'));
   }
   if(target.state==='prepared'&&target.key==='first_sponsor'&&!target.to_email){
    const email=document.createElement('input');email.type='email';email.placeholder='Verified sponsor email';
    const source=document.createElement('input');source.type='url';source.placeholder='https://... public contact source';
    section.append(email,source,commercialButton('Founder: save verified sponsor contact',async()=>{
     await os('commercial/contact','POST',{key:target.key,email:email.value,source:source.value},true);
    }));
   }
   if(target.state!=='delivery_unknown'&&target.state!=='sending'){
    section.append(commercialButton('Record external evidence (operator-reported)',async()=>{
     const kind=prompt('Event type: submitted, replied, or rejected');
     if(!kind)return;
     const reference=prompt('Actual external evidence reference (portal ticket, provider email ID, or message link):');
     if(!reference)return;
     await os('commercial/evidence','POST',{key:target.key,kind,reference});
    }));
   }
   panel.append(section);
  }
 }catch(e){$('commercialStatus').textContent=e.message;}
}
