import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assessCompanyOutcome, COMPANY_OS_EVIDENCE_GATE_VERSION} from '../src/company-os/shared-evidence-gate.mjs';

const project='noetfield-earnloop';
const work='a'.repeat(32),sha='b'.repeat(40);
const claim={
  project_id:project,workstream_id:work,
  source:{artifact_sha:sha,ref:'receipt:source/provenance'},
  verification:{
    project_id:project,workstream_id:work,artifact_sha:sha,
    result:'PASS',receipt_ref:'receipt:independent/source-readback-claim'
  }
};
test('Canonical Company OS evidence gate v1 never self-certifies an untrusted receipt',()=>{
  const r=assessCompanyOutcome(claim);
  assert.equal(r.schema,COMPANY_OS_EVIDENCE_GATE_VERSION);
  assert.equal(r.state,'RECEIPT_CLAIM_READY_FOR_INDEPENDENT_VERIFIER');
  assert.equal(r.next_action,'VERIFY_RECEIPT_SIGNATURE_AND_PROVENANCE');
  assert.equal(r.independent_completion_verified,false);
  assert.equal(r.commercial_outcome_verified,false);
  assert.equal(r.governor_permits_issued,0);
});
test('Cross-tenant, tampered artifact and absent verifier claim are held',()=>{
  const cases=[
    {...claim,project_id:'wrong-project'},
    {...claim,workstream_id:'c'.repeat(32)},
    {...claim,source:{...claim.source,artifact_sha:'c'.repeat(40)}},
    {...claim,verification:null},
    {...claim,source:{...claim.source,ref:'fake-proof'}},
    {...claim,verification:{...claim.verification,result:'FAIL'}}
  ];
  for(const v of cases){
    const r=assessCompanyOutcome(v);
    assert.notEqual(r.state,'RECEIPT_CLAIM_READY_FOR_INDEPENDENT_VERIFIER');
    assert.equal(r.independent_completion_verified,false);
    assert.equal(r.governor_permits_issued,0);
  }
});
test('Source-reported CAD paid invoice never becomes verified collected cash',()=>{
  const r=assessCompanyOutcome({...claim,commercial:{
    currency:'CAD',collected_cash_cents:1900,settlement_verified:true,
    provider_receipt_ref:'receipt:stripe/source-claim'
  }});
  assert.equal(r.receipt_shape_consistent,true);
  assert.equal(r.commercial_claim_shape_consistent,true);
  assert.equal(r.commercial_outcome_verified,false);
  assert.equal(r.independent_completion_verified,false);
  const held=assessCompanyOutcome({...claim,commercial:{
    currency:'CAD',collected_cash_cents:0,settlement_verified:false,
    provider_receipt_ref:'receipt:stripe/unverified'
  }});
  assert.equal(held.state,'CASH_EVIDENCE_INCOMPLETE');
});
test('Actual independent runner CLI reuses the same local portable module and refuses identity drift',()=>{
  const script=fileURLToPath(new URL('../scripts/company-os-receipt-gate.mjs',import.meta.url));
  const evidence={repo:'Noetfield-Systems/Earnloop',project_id:project,workstream_id:work,head_sha:sha};
  const run=body=>spawnSync(process.execPath,[script],{
    input:JSON.stringify(body),encoding:'utf8',timeout:8000
  });
  const good=run(evidence);
  assert.equal(good.status,0,good.stderr);
  const result=JSON.parse(good.stdout);
  assert.equal(result.state,'RECEIPT_CLAIM_READY_FOR_INDEPENDENT_VERIFIER');
  assert.equal(result.independent_completion_verified,false);
  assert.equal(result.commercial_outcome_verified,false);
  assert.equal(result.project_id,project);
  for(const mutated of [
    {...evidence,project_id:'cross-tenant'},
    {...evidence,repo:'Noetfield-Systems/Other'},
    {...evidence,workstream_id:'not-canonical'},
    {...evidence,head_sha:'f'.repeat(39)}
  ]){
    const bad=run(mutated);
    assert.notEqual(bad.status,0);
    assert.equal(bad.stdout,'');
  }
});
