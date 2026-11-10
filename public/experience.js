/* Earnloop member experience: uses existing authenticated server state; never simulates rewards. */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  let current=null;
  const number=value=>Math.max(0,Number(value)||0).toLocaleString('en-CA');
  function level(xp){return Math.floor(Math.max(0,xp)/150)+1;}
  function todayUTC(){return new Date().toISOString().slice(0,10);}
  function notice(text){
    const output=byId('actionStatus');
    if(output)output.textContent=text;
    const member=byId('memberMessage');
    if(member)member.textContent=text;
  }
  function inviteUrl(member){
    const u=new URL(window.location.origin+'/');
    u.searchParams.set('ref',member.code);
    return u.toString();
  }
  function render(member,stats){
    current=member;
    const xp=Number(member?.xp)||0;
    const step=xp%150;
    const next=150-step;
    const streak=Number(member?.streak)||0;
    const invited=Number(member?.unverified_invites)||0;
    const checked=Boolean(member?.last_checkin&&String(member.last_checkin).slice(0,10)===todayUTC());
    if(byId('experienceStatus'))byId('experienceStatus').textContent=member?'FOUNDING MEMBER':'OPEN TO EVERYONE';
    if(byId('experienceTitle'))byId('experienceTitle').textContent=member?'Your next chapter starts here.':'Your community era starts here.';
    if(byId('experienceCopy'))byId('experienceCopy').textContent=member
      ? 'You are on level '+level(xp)+'. Every check-in builds non-cash progress. Explore the club and bring your friends along.'
      : 'Create your private explorer session, claim daily community XP and unlock your personal invitation link. Free to join.';
    if(byId('memberLevel'))byId('memberLevel').textContent='LEVEL '+level(xp);
    if(byId('xpProgress'))byId('xpProgress').textContent=number(step)+' / 150 XP';
    if(byId('xpToNext'))byId('xpToNext').textContent=number(next)+' XP to next level';
    if(byId('progressFill')){byId('progressFill').style.width=Math.min(100,step/150*100)+'%';byId('progressFill').setAttribute('aria-valuenow',String(step));}
    if(byId('streakCount'))byId('streakCount').textContent=member?number(streak)+' day'+(streak===1?'':'s'):'—';
    if(byId('referralCount'))byId('referralCount').textContent=member?number(invited):'—';
    if(byId('experienceStart'))byId('experienceStart').textContent=member?(checked?'Come back tomorrow ↗':'Claim today’s XP ↗'):'Join the founding club ↗';
    if(byId('questStateCheckin'))byId('questStateCheckin').textContent=checked?'Complete today':'Ready when you are';
    if(byId('questStateInvite'))byId('questStateInvite').textContent=invited>0?'Invites tracked':'Invite a friend';
    if(byId('questStatePartner'))byId('questStatePartner').textContent=stats?.offerwall_status==='publisher_approved'?'Publisher configuration available':'Awaiting verified partner';
    if(byId('journeyJoined'))byId('journeyJoined').classList.toggle('complete',!!member);
    if(byId('journeyDaily'))byId('journeyDaily').classList.toggle('complete',checked);
    if(byId('journeyInvited'))byId('journeyInvited').classList.toggle('complete',invited>0);
    if(byId('invitationLink'))byId('invitationLink').value=member?inviteUrl(member):'Join to unlock your personal link';
    if(byId('memberCode'))byId('memberCode').textContent=member?'YOUR CODE · '+member.code.toUpperCase():'MEMBERS-ONLY INVITATION';
  }
  async function ensureMember(){
    if(current)return current;
    if(!window.Earnloop)throw new Error('Member session not ready');
    await window.Earnloop.enroll();
    current=window.Earnloop.member();
    return current;
  }
  async function copyInvite(){
    try{
      const m=await ensureMember();
      if(!m)return;
      const url=inviteUrl(m);
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(url);}
      else{const field=byId('invitationLink');field.value=url;field.focus();field.select();document.execCommand('copy');}
      notice('Personal invitation link copied. Share it with someone you know.');
    }catch(e){notice('Copy unavailable. Select your invitation link and copy it manually.');}
  }
  async function shareInvite(){
    try{
      const m=await ensureMember();
      if(!m)return;
      const url=inviteUrl(m);
      if(typeof navigator.share==='function')await navigator.share({title:'Join the Earnloop founding club',text:'Join me in the Earnloop community. Start with non-cash XP quests.',url});
      else await copyInvite();
    }catch(e){if(e.name!=='AbortError')notice('Sharing unavailable. Try copying your invitation link.');}
  }
  function bind(id,fn){const el=byId(id);if(el)el.addEventListener('click',fn);}
  bind('experienceStart',async()=>{
    try{
      if(!current){await ensureMember();return;}
      if(byId('questStateCheckin')?.textContent==='Complete today'){byId('quests')?.scrollIntoView({behavior:'smooth'});notice('Today’s XP is already claimed. Come back tomorrow.');return;}
      byId('checkin')?.click();
    }catch(e){notice(e.message||'Action temporarily unavailable');}
  });
  bind('copyInvitePremium',copyInvite);
  bind('shareInvite',shareInvite);
  bind('catalogCommunity',()=>byId('quests')?.scrollIntoView({behavior:'smooth'}));
  document.addEventListener('earnloop:updated',event=>render(event.detail.member,event.detail.stats));
  if(window.Earnloop?.member())render(window.Earnloop.member(),null);
  else render(null,null);
})();