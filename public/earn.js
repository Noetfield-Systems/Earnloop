const $=id=>document.getElementById(id);
let member=null,inventory=null;
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;}
async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});let j;try{j=await r.json()}catch{throw Error('Unexpected server response')}if(!r.ok)throw Error(j.error||'Request failed');return j;}
function signupAttribution(defaultSource='earn'){
  const params=new URL(location.href).searchParams;
  const ref=(params.get('ref')||'').trim().toLowerCase();
  const source=(params.get('utm_source')||'').trim();
  return {source:/^[a-zA-Z0-9_-]{1,40}$/.test(source)?source:defaultSource,
    ...(/^[a-f0-9]{12}$/.test(ref)?{ref}:{})};
}
async function load(){
 try{
  const [profile,offers,providerStatus]=await Promise.all([api('/api/me'),api('/api/earn/offers'),api('/api/offerwall/status')]);
  $('nativeCatalogSection').hidden=providerStatus.native_catalog_available!==true;
  inventory=offers;member=profile.member;
  let journey=null;
  const box=$('memberState');box.replaceChildren();
  box.append(el('h3',member?'Your account · Explorer '+member.code.slice(-4).toUpperCase():'Start as a founding member'));
  box.append(el('p',member?'Noncash XP: '+member.xp+' · Activity is not yet identity verification.':'Create a private session to participate. You may join the mailing list separately on the homepage.'));
  if(!member){const b=el('button','Create member session','primary');b.addEventListener('click',async()=>{b.disabled=true;try{await api('/api/start','POST',signupAttribution());await load();}catch(e){box.append(el('p',e.message));}finally{b.disabled=false;}});box.append(b);}
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
    journey=await api('/api/journey');
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
  const balanceBox=$('rewardBalance');balanceBox.replaceChildren();
  if(member){
    const status=await api('/api/earn/balance');
    const source=status.source,cash=status.cash;
    balanceBox.append(el('h3','Your actual reward status'));
    const overview=el('div',null,'mini-grid');
    overview.append(
      el('div','Conversion reports: '+source.conversions_reported,'item'),
      el('div','Reversal reports: '+source.reversals_reported,'item'),
      el('div','Net reported provider units: '+source.net_reported_units,'item'),
      el('div','Confirmed cash rewards: '+(cash.confirmed_rewards_minor/100).toFixed(2)+' (currency not established)','item'),
      el('div','Available for redemption: '+(cash.available_for_redemption_minor/100).toFixed(2)+' (not funded)','item')
    );
    balanceBox.append(overview,el('p','Provider units are NOT redeemable cash. Source reversals are independent reports awaiting reconciliation.'));
    balanceBox.append(el('small','Status: '+cash.classification+' · Cash payouts require real advertiser settlement and prefunded fulfillment.'));
  }else balanceBox.append(el('p','Join to see your source reports. There is no verified redeemable cash balance yet.'));
  const req=$('requests');req.replaceChildren();
  if(member){const d=await api('/api/earn/redemptions');for(const r of d.requests){req.append(el('div',r.state+' · '+r.currency+' '+(r.amount_minor/100).toFixed(2)+' · '+new Date(r.created_at).toLocaleDateString(),'item'));}if(!d.requests.length)req.append(el('p','No redemption-interest requests recorded.'));}
  else req.append(el('p','Create a session to view requests.'));
  document.dispatchEvent(new CustomEvent('earnloop:member-journey',{detail:{member,journey,offerCount:offers.offers.length,offerwall:providerStatus}}));
 }catch(e){$('memberState').textContent='Unable to load live member data: '+e.message;
  document.dispatchEvent(new CustomEvent('earnloop:member-journey',{detail:{error:e.message}}));}
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

async function loadNativeOffers(){
  const list=$('nativeCatalogOffers'),state=$('nativeCatalogStatus');
  list.replaceChildren();
  const geo=$('nativeCountry').value.trim().toUpperCase();
  const os=$('nativeDevice').value;
  if(!/^[A-Z]{2}$/.test(geo)){state.textContent='Enter a two-letter country code such as CA or US.';return;}
  state.textContent='Checking partner inventory for '+geo+' / '+os+'…';
  try{
    const data=await api('/api/offerwall/catalog?geo='+encodeURIComponent(geo)+'&os='+encodeURIComponent(os));
    state.textContent=data.offers.length+' partner-listed offers for '+geo+' / '+os+
      (data.inventory_uncertain?' · Empty response may indicate a partner issue.':'');
    for(const offer of data.offers){
      const card=el('article',null,'panel');
      card.append(el('div','TOROX · '+offer.os,'eyebrow'),el('h3',offer.name),el('p',offer.description));
      if(offer.reward_units!=null)card.append(el('p',offer.reward_units+' provider-configured reward units · unverified, not cash'));
      if(offer.milestones?.length)card.append(el('p',offer.milestones.length+' provider milestones. Review their requirements before starting.'));
      const button=el('button',member?'View and start offer':'Join and start offer','action');
      button.addEventListener('click',async()=>{
        button.disabled=true;
        try{
          if(!member)await api('/api/start','POST',signupAttribution('native-offer'));
          const next=await api('/api/offerwall/click','POST',{geo,campaign_id:offer.campaign_id});
          const u=new URL(next.click_url);
          if(u.protocol!=='https:'||!(u.hostname==='torox.io'||u.hostname.endsWith('.torox.io')))throw Error('Unexpected partner destination');
          location.assign(u.toString());
        }catch(error){
          state.textContent='Could not open offer: '+error.message;
          button.disabled=false;
        }
      });
      card.append(button);list.append(card);
    }
    if(!data.offers.length)list.append(el('p','No confirmed eligible offers from this partner response. Try your actual device and country later.','empty'));
  }catch(error){
    state.textContent='Partner inventory unavailable: '+error.message;
    list.append(el('p','You can still participate in the free Earnloop community.','empty'));
  }
}
$('nativeCatalogForm').addEventListener('submit',event=>{event.preventDefault();loadNativeOffers();});
const localeRegion=(navigator.language||'').match(/-([A-Z]{2})$/i);
if(localeRegion)$('nativeCountry').value=localeRegion[1].toUpperCase();
$('nativeDevice').value=/android/i.test(navigator.userAgent)?'android':/iPad|iPhone|iPod/i.test(navigator.userAgent)?'ios':'web';
