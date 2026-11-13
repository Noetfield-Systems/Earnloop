import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRewardCreditReadiness as assess } from '../src/company-os/generated/feature_753d32cfd899.mjs';
const base={publisherApproved:true,callbackVerified:true,reversalPending:false,settledGrossCents:1000,rewardLiabilityCents:250,cashIndependentlyVerified:true};
test('valid evidence is review-eligible, never an automatic payout',()=>{assert.deepEqual(assess(base),{state:'REVIEW_ELIGIBLE',creditReady:true,payoutReady:false})});
test('source-reported money is not independently verified',()=>{assert.equal(assess({...base,cashIndependentlyVerified:false}).state,'CASH_UNVERIFIED')});
test('negative and overdrawn liability fail closed',()=>{assert.equal(assess({...base,rewardLiabilityCents:1001}).state,'INVALID_ACCOUNTING');assert.equal(assess({...base,settledGrossCents:-1}).creditReady,false)});
test('callbacks, approval and reversals remain hard gates',()=>{assert.equal(assess({...base,callbackVerified:false}).creditReady,false);assert.equal(assess({...base,publisherApproved:false}).creditReady,false);assert.equal(assess({...base,reversalPending:true}).creditReady,false)});
