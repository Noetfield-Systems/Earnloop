/**
 * The SAME Company OS evidence-gate contract runs at the real GitHub readback
 * boundary for Noetfield-Systems/Earnloop. A shape-ready claim is never independent proof,
 * a deploy authorization, or a collected-cash statement.
 */
import fs from 'node:fs';
import {assessCompanyOutcome, COMPANY_OS_EVIDENCE_GATE_VERSION} from '../src/company-os/shared-evidence-gate.mjs';

try {
  const raw=fs.readFileSync(0,'utf8');
  if(raw.length>20000)throw new Error('EVIDENCE_TOO_LARGE');
  const evidence=JSON.parse(raw);
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
     evidence.repo!=='Noetfield-Systems/Earnloop'||
     evidence.project_id!=='noetfield-earnloop'||
     !/^[0-9a-f]{40}$/.test(evidence.head_sha||''))throw new Error('SOURCE_IDENTITY_REJECTED');
  // The independent GitHub runner already fetched this exact SHA and checked
  // the source-file hashes and complete application tests BEFORE this call.
  // Here we ONLY assess the next reusable Company OS evidence boundary.
  const claim={
    project_id:evidence.project_id,
    workstream_id:evidence.workstream_id,
    source:{
      artifact_sha:evidence.head_sha,
      ref:'receipt:github-source-readback-claim/'+evidence.head_sha
    },
    verification:{
      project_id:evidence.project_id,
      workstream_id:evidence.workstream_id,
      artifact_sha:evidence.head_sha,
      result:'PASS',
      receipt_ref:'receipt:github-action-readback-claim/'+evidence.head_sha
    }
  };
  const decision=assessCompanyOutcome(claim);
  if(decision.schema!==COMPANY_OS_EVIDENCE_GATE_VERSION||
     decision.state!=='RECEIPT_CLAIM_READY_FOR_INDEPENDENT_VERIFIER'||
     decision.independent_completion_verified!==false||
     decision.commercial_outcome_verified!==false||
     decision.governor_permits_issued!==0||
     decision.next_action!=='VERIFY_RECEIPT_SIGNATURE_AND_PROVENANCE')
    throw new Error('CANONICAL_EVIDENCE_GATE_REJECTED');
  process.stdout.write(JSON.stringify({
    schema:decision.schema,state:decision.state,
    next_action:decision.next_action,
    independent_completion_verified:false,
    commercial_outcome_verified:false,
    source_artifact_sha:evidence.head_sha,
    project_id:evidence.project_id
  })+'\n');
} catch (err) {
  process.stderr.write('COMPANY_OS_EVIDENCE_GATE_FAILED:'+String(err?.message||'unknown').slice(0,120)+'\n');
  process.exitCode=1;
}
