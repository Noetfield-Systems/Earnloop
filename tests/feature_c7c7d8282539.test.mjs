import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessQualifiedInvite as assess } from '../src/company-os/generated/feature_c7c7d8282539.mjs';
const base={selfReferral:false,duplicateInvite:false,accountVerified:true,checkinVerified:true,puzzleVerified:true};
test('only authentic two-activity invite is qualified, never cash',()=>{assert.deepEqual(assess(base),{state:'QUALIFIED_NONCASH_ONLY',qualified:true,cashRewardEligible:false})});
test('checkin alone and puzzle alone are insufficient',()=>{assert.equal(assess({...base,puzzleVerified:false}).qualified,false);assert.equal(assess({...base,checkinVerified:false}).qualified,false)});
test('self referral and duplicates are never eligible',()=>{assert.equal(assess({...base,selfReferral:true}).state,'SELF_REFERRAL');assert.equal(assess({...base,duplicateInvite:true}).state,'DUPLICATE_INVITATION')});
test('account and evidence must actually be verified booleans',()=>{assert.equal(assess({...base,accountVerified:false}).qualified,false);assert.equal(assess({...base,checkinVerified:'yes'}).state,'INVALID_EVIDENCE')});
