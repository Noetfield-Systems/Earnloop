require('node:fs').mkdirSync('test-results',{recursive:true});
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3100');await page.click('#joinHero');await page.waitForFunction(()=>window.Earnloop?.member());await page.click('#checkin');await page.waitForFunction(()=>document.getElementById('myXp').textContent==='15');await page.click('#playStart');await page.waitForSelector('#puzzleForm:not([hidden])');const q=await page.locator('#puzzleQuestion').textContent();const n=q.match(/\d+/g).map(Number);await page.fill('#puzzleAnswer',String(n[0]+n[1]));await page.click('#puzzleSubmit');await page.waitForFunction(()=>document.getElementById('myXp').textContent==='25');await page.fill('#supportSubject','Local test support');await page.fill('#supportMessage','This record exists only in the isolated test database.');await page.click('#supportForm button');await page.waitForFunction(()=>document.getElementById('supportCases').textContent.includes('Local test support'));const invite=await page.locator('#invitationLink').inputValue();
if(!invite.includes('ref='))throw Error('Member invitation link missing');
const friend=await browser.newPage({viewport:{width:390,height:844}});
await friend.goto(invite);
await friend.click('#joinHero');
await friend.waitForFunction(()=>window.Earnloop?.member());
await friend.click('#checkin');
await friend.waitForFunction(()=>document.getElementById('myXp').textContent==='15');
await friend.click('#playStart');
await friend.waitForSelector('#puzzleForm:not([hidden])');
const friendQ=await friend.locator('#puzzleQuestion').textContent();
const friendNums=friendQ.match(/\d+/g).map(Number);
await friend.fill('#puzzleAnswer',String(friendNums[0]+friendNums[1]));
await friend.click('#puzzleSubmit');
await friend.waitForFunction(()=>document.getElementById('myXp').textContent==='25');
await page.reload();
await page.waitForFunction(()=>document.getElementById('referralCount')?.textContent.includes('1 active / 1 joined'));
await friend.close();
await page.screenshot({path:'test-results/earnloop-mobile.png',fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right})).slice(0,25)));await page.goto('http://127.0.0.1:3100/sponsor');await page.fill('#sponsorEmail','test@example.com');await page.fill('#sponsorName','Local Test Sponsor');await page.fill('#sponsorBrief','Isolated local integration test, not a real commercial lead.');await page.check('#sponsorConsent');await page.click('#sponsorForm button');await page.waitForFunction(()=>document.getElementById('sponsorStatus').textContent.includes('Inquiry saved'));await page.goto('http://127.0.0.1:3100/earn');
await page.waitForSelector('#offers .empty');
await page.waitForSelector('#questMap .reward-station');
if(await page.locator('#questMap .reward-station').count()!==6)throw Error('Expected six real activity stations');
const sourceMilestones=await page.evaluate(async()=>{
 const [identity,journey]=await Promise.all([fetch('/api/me').then(r=>r.json()),fetch('/api/journey').then(r=>r.json())]);
 const today=new Date().toISOString().slice(0,10);
 const activity=journey.activity||[];
 const onDay=kind=>activity.some(e=>e.kind===kind&&String(e.created_at).slice(0,10)===today);
 return Number(Boolean(identity.member))+
 Number(onDay('daily_checkin'))+Number(onDay('puzzle_completed'))+
 Number((identity.member?.activity_qualified_invites||0)>0)+
 Number(activity.some(e=>['offer_started','offer_start','offer_click'].includes(e.kind)))+
 Number((journey.partner_reports||[]).length>0);
});
const earnedCount=await page.locator('#questMap .reward-station.earned').count();
if(earnedCount!==sourceMilestones)throw Error('Milestone mismatch: UI='+earnedCount+' source='+sourceMilestones);
if(!(await page.locator('#questMapCount').textContent()).includes(sourceMilestones+' / 6'))throw Error('Quest progress must reflect actual persisted events');
if(!(await page.locator('#questMap').textContent()).includes('Partner inventory has not been confirmed'))throw Error('Unavailable advertiser inventory must remain explicit');
await page.screenshot({path:'test-results/earnloop-quest-path-mobile.png',fullPage:true});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Quest Map overflows mobile viewport');

await page.fill('#amount','2500');
await page.check('#ack');
await page.click('#redeemForm button');
await page.waitForFunction(()=>document.getElementById('redemptionMessage').textContent.includes('interest_unfunded'));
await page.goto('http://127.0.0.1:3100/operations');
await page.fill('#token','local-integration-token-for-tests-only');
await page.click('#connect');
await page.waitForFunction(()=>document.getElementById('conn-state').textContent.includes('Authenticated'),{timeout:15000});
await page.click('[data-view="transactions"]');
await page.getByText('Conversion & transaction register').waitFor();
await page.screenshot({path:'test-results/operations-mobile.png',fullPage:true});
console.log(JSON.stringify({mobileOverflow:overflow,errors,memberXp:25,puzzle:true,support:true,sponsorIntake:true,isolatedRedemptionInterest:true,operationsAuthenticated:true,productionUsersCreated:0}));await browser.close();if(errors.length||overflow)process.exit(1);})();
