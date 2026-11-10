const $=id=>document.getElementById(id);
let me=null;
let offerwallEnabled=false;
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json'},...options});const body=await r.json();if(!r.ok)throw new Error(body.error||'Something went wrong');return body;}
function number(n){return Number(n||0).toLocaleString('en-CA');}
function message(msg){if($('memberMessage'))$('memberMessage').textContent=msg;}
async function refresh(){
 try{
  const [stats,identity,board,offerwall]=await Promise.all([api('/api/stats'),api('/api/me'),api('/api/leaderboard'),api('/api/offerwall/status')]);
  offerwallEnabled=offerwall.enabled===true;
  $('offerwall-button').disabled=!offerwallEnabled;
  $('offerwall-button').textContent=offerwallEnabled?'Explore offers ↗':'Partner inventory pending';
  $('offerwall-status-label').textContent=offerwallEnabled?'APPROVED OFFERWALL':'PARTNER APPROVAL PENDING';
  $('memberCount').textContent=number(stats.members);$('waitlistCount').textContent=number(stats.early_access);
  me=identity.member;$('myXp').textContent=number(me?.xp);$('myReferrals').textContent=number(me?.unverified_invites);$('memberStatus').textContent=me?'FOUNDING MEMBER':'NOT JOINED';
  if(me)message('Your invite code: '+me.code+' · Non-cash XP only');
  const list=$('leaders');list.replaceChildren();
  if(!board.leaders.length){const el=document.createElement('div');el.className='empty';el.textContent='Be the first real explorer on the board.';list.append(el);}
  else board.leaders.forEach((p,i)=>{const item=document.createElement('div');item.className='leader';const rank=document.createElement('span');rank.textContent=String(i+1).padStart(2,'0');const name=document.createElement('strong');name.textContent=p.name;const xp=document.createElement('b');xp.textContent=number(p.xp)+' XP';item.append(rank,name,xp);list.append(item);});
 }catch(e){message('Connection unavailable: '+e.message);}
}
async function enroll(){
 try{const url=new URL(location.href),ref=url.searchParams.get('ref')||'';const r=await api('/api/start',{method:'POST',body:JSON.stringify({ref})});me=r.member;message('Explorer membership activated. Welcome to the loop!');await refresh();document.getElementById('quests').scrollIntoView({behavior:'smooth'});}
 catch(e){message(e.message);}
}
async function startOfferwall(){
 if(!offerwallEnabled){message('Sponsored offers are awaiting partner acceptance.');return;}
 if(!me){await enroll();if(!me)return;}
 const button=$('offerwall-button');button.disabled=true;
 try{
  const data=await api('/api/offerwall/session');
  const u=new URL(data.wall_url);
  if(u.protocol!=='https:'||!['wall.torox.io','wall.stage.torox.io'].includes(u.hostname))
   throw new Error('Untrusted partner URL');
  location.assign(u.toString());
 }catch(err){message('Offerwall temporarily unavailable: '+err.message);button.disabled=!offerwallEnabled;}
}
$('offerwall-button').addEventListener('click',startOfferwall);
$('navJoin').addEventListener('click',enroll);$('joinHero').addEventListener('click',enroll);
$('checkin').addEventListener('click',async()=>{try{if(!me){await enroll();}const r=await api('/api/checkin',{method:'POST',body:'{}'});message(r.awarded?'You earned 15 community XP today.':'You already checked in today.');await refresh();}catch(e){message(e.message);}});
$('copyInvite').addEventListener('click',async()=>{try{if(!me)await enroll();if(!me)return;const url=new URL(location.origin);url.searchParams.set('ref',me.code);await navigator.clipboard.writeText(url.href);message('Your invite link has been copied.');}catch(e){message('Unable to copy: '+e.message);}});
$('waitlist').addEventListener('submit',async(e)=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const v=await api('/api/join',{method:'POST',body:JSON.stringify({email:$('email').value,consent:$('consent').checked,website:e.currentTarget.elements.website.value})});$('formMessage').textContent=v.message||'Thanks for joining!';await refresh();}catch(err){$('formMessage').textContent=err.message;}finally{button.disabled=false;}});
refresh();
