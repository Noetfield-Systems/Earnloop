/* Earnloop Quest Map — real source-backed participation, not cash or verified identity. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const todayUTC=()=>new Date().toISOString().slice(0,10);
  const eventOnDay=(activity,kind,day)=>Array.isArray(activity)&&activity.some(x=>x&&x.kind===kind&&typeof x.created_at==="string"&&x.created_at.slice(0,10)===day);
  const hasEvent=(activity,kind)=>Array.isArray(activity)&&activity.some(x=>x&&x.kind===kind);
  const safeCount=n=>Number.isFinite(Number(n))&&Number(n)>0?Math.floor(Number(n)):0;
  const stations=(member,journey,offerCount,offerwall,day=todayUTC())=>{
    const activity=journey?.activity||[];
    const haveOffers=safeCount(offerCount)>0||offerwall?.enabled===true||offerwall?.native_catalog_available===true;
    const hasOfferActivity=hasEvent(activity,"offer_started")||hasEvent(activity,"offer_click")||hasEvent(activity,"offer_start");
    const hasReport=Array.isArray(journey?.partner_reports)&&journey.partner_reports.length>0;
    const reportCount=journey?.partner_reports?.length||0;
    return [
      {id:"join",number:"01",title:"Become an explorer",help:"Create a real, private member session.",complete:!!member,available:true,action:"#memberState",next:"Join the club"},
      {id:"checkin",number:"02",title:"Check in today",help:"Earn non-cash community XP once each UTC day.",complete:eventOnDay(activity,"daily_checkin",day),available:!!member,action:"/#quests",next:"Check in today"},
      {id:"play",number:"03",title:"Play today’s puzzle",help:"Finish the daily number challenge in the real game.",complete:eventOnDay(activity,"puzzle_completed",day),available:!!member,action:"/#play",next:"Play today’s puzzle"},
      {id:"invite",number:"04",title:"Build your circle",help:"An invited friend checked in and finished a puzzle; this is activity-qualified, not identity verified.",complete:safeCount(member?.activity_qualified_invites)>0,available:!!member,action:"/#experience",next:"Share your invitation"},
      {id:"offer",number:"05",title:"Discover partner offers",help:haveOffers?"Start a real approved-source offer. A started action is not a paid conversion.":"Partner inventory has not been confirmed; community activities remain available.",complete:hasOfferActivity,available:!!member&&haveOffers,action:"#offers",next:"Browse real offers"},
      {id:"report",number:"06",title:"Review partner reports",help:hasReport?reportCount+" source report(s) received. No settlement or cash balance is implied.":"A partner callback will appear here only if actually received; it is not proof of payout.",complete:hasReport,available:!!member&&hasReport,action:"#partnerReports",next:"Inspect source reports"}
    ];
  };
  const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(payload){
    const root=$("questMap"),counter=$("questMapCount"),nextLink=$("questMapNext"),feedback=$("questMapFeedback");
    if(!root||!counter||!nextLink||!feedback)return;
    if(payload?.error){
      root.innerHTML='<div class="reward-quest-empty">Cannot read today’s activity. No progress is being estimated.</div>';
      counter.textContent="—";nextLink.href="#memberState";nextLink.textContent="Review member session →";
      feedback.textContent="Live activity unavailable. Refresh the page to retry. "+String(payload.error).slice(0,120);
      return;
    }
    const member=payload?.member||null;
    const journey=payload?.journey||null;
    const list=stations(member,journey,payload?.offerCount||0,payload?.offerwall||null);
    const earned=list.filter(step=>step.complete).length;
    counter.textContent=earned+" / "+list.length;
    root.innerHTML=list.map(step=>'<a role="listitem" class="reward-station'+
      (step.complete?" earned":step.available?" available":" locked")+
      '" href="'+esc(step.action)+'" aria-label="'+esc(step.title+(step.complete?" completed":""))+'">'+
      '<span class="reward-station-top"><span>'+step.number+' / STATION</span><span class="reward-station-badge">'+
      (step.complete?"✓ Done":step.available?"Open":"Not available")+'</span></span>'+
      '<span class="reward-station-symbol" aria-hidden="true">'+
      (step.complete?"✓":({join:"✳",checkin:"☀",play:"◈",invite:"◇",offer:"◎",report:"▧"})[step.id])+'</span>'+
      '<strong>'+esc(step.title)+'</strong><small>'+esc(step.help)+'</small>'+
      '<span class="reward-station-cta">'+(step.complete?"View activity →":step.available?"Continue →":"Check later")+'</span></a>'
    ).join("");
    const next=list.find(step=>step.available&&!step.complete)||
      (!member?list[0]:list.find(step=>step.id==="checkin"));
    nextLink.href=next.action;nextLink.textContent=(earned===list.length?"Keep participating":"Next: "+next.next)+" →";
    feedback.textContent=member?
      "Source-backed activity · "+earned+" of 6 milestones recorded for this journey. Daily activities reset at 00:00 UTC. Partner reports are not cash.":
      "Join free to unlock your personal quests and source-backed progress. No card or payout balance is required.";
  }
  document.addEventListener("earnloop:member-journey",e=>render(e.detail));
  if(typeof window!=="undefined")window.EarnloopQuest=Object.freeze({stations,render});
})();