import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLICATION_TARGETS,nextCommercialAction} from '../src/company-os/replication.mjs';

test('exact upstream sources and targets are machine-readable, without claim of licensed Freecash source',()=>{
 assert.equal(REPLICATION_TARGETS.length,8);
 for(const entry of REPLICATION_TARGETS){assert.match(entry.source,/^https:\/\//);assert.ok(entry.method);assert.ok(entry.target);assert.ok(entry.owner);}
 assert.equal(REPLICATION_TARGETS.find(x=>x.id==='benchmark').method,'replicate_mechanics_only');
 assert.match(REPLICATION_TARGETS.find(x=>x.id==='saas_starter').commit,/^[a-f0-9]{40}$/);
});
test('commercial engine prioritizes real acceptance and cash before user growth',()=>{
 assert.equal(nextCommercialAction({},{}).action,'obtain_publisher_acceptance');
 const accepted={TOROX_PUBLISHER_APPROVED:'true',TOROX_APPROVAL_REFERENCE:'real-document'};
 assert.equal(nextCommercialAction({},accepted).action,'configure_publisher_placement_privately');
 const ready={...accepted,TOROX_PLACEMENT_ID:'source',TOROX_APP_TOKEN:'private',TOROX_MODE:'staging'};
 assert.equal(nextCommercialAction({},ready).action,'verify_real_partner_callbacks_and_reversals');
 assert.equal(nextCommercialAction({members:0},{...ready,TOROX_POSTBACK_VERIFIED:'true'}).action,'acquire_first_real_eligible_member');
 assert.equal(nextCommercialAction({settled_events:0,members:1},{...ready,TOROX_POSTBACK_VERIFIED:'true'}).action,'obtain_first_partner_verified_payable_action');
 assert.equal(nextCommercialAction({settled_events:1,members:3},{...ready,TOROX_POSTBACK_VERIFIED:'true'}).action,'reconcile_collected_cash_and_funded_reward');
 assert.equal(nextCommercialAction({settled_events:400,members:100000,activated:60000},{...ready,TOROX_POSTBACK_VERIFIED:'true'}).action,'reconcile_collected_cash_and_funded_reward');
 assert.equal(nextCommercialAction({settled_events:1,members:3,claimed_profit:999999},{...ready,TOROX_POSTBACK_VERIFIED:'true'}).external_action_executed,false);
});
