const $=id=>document.getElementById(id);
let member=null,inventory=null;
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;}
async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});let j;try{j=await r.json()}catch{throw Error('Unexpected server response')}if(!r.ok)throw Error(j.error||'Request failed');return j;}
async function load(){
 try{
  const [profile,offers]=await Promise.all([api('/api/me'),api('/api/earn/offers')]);
  inventory=offers;member=profile.member;
  const box=$('memberState');box.replaceChildren();
  box.append(el('h3',member?'Your account · Explorer '+member.code.slice(-4).toUpperCase():'Start as a founding member'));
  box.append(el('p',member?'Noncash XP: '+member.xp+' · Activity is not yet identity verification.':'Create a private session to participate. You may join the mailing list separately on the homepage.'));
  if(!member){const b=el('button','Create member session','primary');b.addEventListener('click',async()=>{b.disabled=true;try{await api('/api/start','POST',{source:'earn'});await load();}catch(e){box.append(el('p',e.message));}finally{b.disabled=false;}});box.append(b);}
  $('offerCount').textContent=offers.offers.length+' actual approved-source listings';
  const list=$('offers');list.replaceChildren();
  for(const offer of offers.offers){
   const card=el('article',null,'panel');card.append(el('div','TRACK '+offer.track+' · '+offer.provider,'eyebrow'),el('h3',offer.title),el('p',offer.description));
   card.append(el('p',offer.reward_minor==null?'No cash reward stated':offer.reward_currency+' '+(offer.reward_minor/100).toFixed(2)+' · not yet funded'));
   const b=el('button',member?'Open offer & record start':'Join to start','action');b.disabled=!member;
   b.addEventListener('click',async()=>{
    b.disabled=true;try{
     const make=()=>Date.now()+'.'+Math.random().toString(36).slice(2);
     await api('/api/earn/track','POST',{offer_id:offer.id,event_type:'click',idempotency_key:'click:'+make()});
     const r=await api('/api/earn/track','POST',{offer_id:offer.id,event_type:'start',idempotency_key:'start:'+make()});
     if(r.destination_url)location.assign(r.destination_url);
    }catch(e){card.append(el('p','Could not start: '+e.message));b.disabled=false;}
   });card.append(b);list.append(card);
  }
  if(offers.torox_session_available){
   const c=el('div',null,'panel');c.append(el('h3','Torox hosted offerwall'),el('p','Actual partner session required; conversion reports are not cash.'));
   const b=el('button','Open approved offerwall','action');b.disabled=!member;b.addEventListener('click',async()=>{b.disabled=true;try{const r=await api('/api/offerwall/session');location.assign(r.wall_url);}catch(e){c.append(el('p',e.message));b.disabled=false;}});c.append(b);list.append(c);
  }
  if(!list.children.length)list.append(el('div','No paid partner offer inventory is available yet. Join the community and check back after an actual publisher approval.','empty'));
  const reports=$('partnerReports'),history=$('supportHistory');
  reports.replaceChildren();history.replaceChildren();
  if(member){
    const journey=await api('/api/journey');
    for(const r of journey.partner_reports||[]){
      const item=el('div',null,'item');
      const kind=r.reversal?'Reversal reported':'Conversion reported';
      item.append(el('strong',kind+' · offer '+r.offer_id));
      item.append(el('p',String(r.amount_units)+' partner reward units · '+new Date(r.received_at).toLocaleDateString()));
      item.append(el('small','Source event '+r.event_id+' · '+r.status+' · not payable'));
      reports.append(item);
    }
    if(!reports.children.length)reports.append(el('p','No partner callbacks recorded for this member yet.'));
    for(const s of journey.support||[]){
      history.append(el('div',s.state+' · '+s.subject+' · '+new Date(s.created_at).toLocaleDateString(),'item'));
    }
    if(!history.children.length)history.append(el('p','No support requests yet.'));
  }else{
    reports.append(el('p','Join to see your conversion and reversal reports.'));
    history.append(el('p','Join to open and track support requests.'));
  }
  const req=$('requests');req.replaceChildren();
  if(member){const d=await api('/api/earn/redemptions');for(const r of d.requests){req.append(el('div',r.state+' · '+r.currency+' '+(r.amount_minor/100).toFixed(2)+' · '+new Date(r.created_at).toLocaleDateString(),'item'));}if(!d.requests.length)req.append(el('p','No redemption-interest requests recorded.'));}
  else req.append(el('p','Create a session to view requests.'));
 }catch(e){$('memberState').textContent='Unable to load live member data: '+e.message;}
}
$('redeemForm').addEventListener('submit',async e=>{e.preventDefault();if(!member){$('redemptionMessage').textContent='Join first.';return;}
 const b=e.submitter;b.disabled=true;try{
  const r=await api('/api/earn/redemption-request','POST',{method:$('method').value,currency:$('currency').value,
   amount_minor:Number($('amount').value),acknowledge_unfunded:$('ack').checked});
  $('redemptionMessage').textContent='Request '+r.id+' recorded: '+r.state+'. This is not a cash obligation.';await load();
 }catch(err){$('redemptionMessage').textContent=err.message;}finally{b.disabled=false;}});
load();
$('creditSupport').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!member){$('supportResult').textContent='Join first.';return;}
  const button=event.submitter;button.disabled=true;
  try{
    const result=await api('/api/support','POST',{
      subject:$('supportSubject').value.trim(),message:$('supportMessage').value.trim()
    });
    $('supportResult').textContent='Support case '+result.id+' opened.';
    $('creditSupport').reset();await load();
  }catch(error){$('supportResult').textContent=error.message;}
  finally{button.disabled=false;}
});
