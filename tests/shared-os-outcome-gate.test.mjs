import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCompanyOutcome, COMPANY_OS_EVIDENCE_GATE_VERSION as VERSION} from '../src/company-os/shared-evidence-gate.mjs';
const record={
 project_id:'noetfield-earnloop', workstream_id:'a'.repeat(32),
 source:{artifact_sha:'b'.repeat(40),ref:'receipt:origin/revision'},
 verification:{project_id:'noetfield-earnloop',workstream_id:'a'.repeat(32),
   artifact_sha:'b'.repeat(40),result:'PASS',receipt_ref:'receipt:untrusted-claim'}
};

test('reusable OS gate rejects missing scope, source and wrong verifier SHA',()=>{
 assert.equal(assessCompanyOutcome(null).state,'INVALID_INPUT');
 assert.equal(assessCompanyOutcome({...record,workstream_id:'wrong'}).state,'INVALID_SCOPE');
 assert.equal(assessCompanyOutcome({...record,source:null}).state,'SOURCE_EVIDENCE_MISSING');
 assert.equal(assessCompanyOutcome({...record,verification:{...record.verification,artifact_sha:'c'.repeat(40)}}).state,'AWAITING_VERIFIER_RECEIPT');
});
test('correct source metadata NEVER self-certifies third party verification',()=>{
 const result=assessCompanyOutcome(record);
 assert.equal(result.schema,VERSION);
 assert.equal(result.receipt_shape_consistent,true);
 assert.equal(result.independent_completion_verified,false);
 assert.equal(result.commercial_outcome_verified,false);
 assert.equal(result.governor_permits_issued,0);
 assert.equal(result.next_action,'VERIFY_RECEIPT_SIGNATURE_AND_PROVENANCE');
});
test('cash is not called collected without valid settlement shape or a verifier',()=>{
 const missing=assessCompanyOutcome({...record,commercial:{currency:'CAD',collected_cash_cents:0}});
 assert.equal(missing.state,'CASH_EVIDENCE_INCOMPLETE');
 const reported=assessCompanyOutcome({...record,commercial:{currency:'CAD',
   collected_cash_cents:1000,settlement_verified:true,provider_receipt_ref:'receipt:provider/paid'}});
 assert.equal(reported.commercial_claim_shape_consistent,true);
 assert.equal(reported.commercial_outcome_verified,false);
 assert.equal(reported.independent_completion_verified,false);
});