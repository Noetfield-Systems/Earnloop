/**
 * Sina Company OS / Shared Outcome Gate v1 — portable, pure decision helper.
 * Input fields are CLAIMS. It never verifies signatures or gives execution
 * authority: only the existing independent Verifier can finalize receipts.
 */
export const COMPANY_OS_EVIDENCE_GATE_VERSION = 'sina.company-os.evidence-gate.v1';
const PROJECT = /^[a-z0-9][a-z0-9-]{2,90}$/;
const WORK = /^[0-9a-f]{32}$/;
const SHA = /^[0-9a-f]{40,64}$/;
const hold = (state,reason) => ({
  schema:COMPANY_OS_EVIDENCE_GATE_VERSION,state,reason,
  next_action:'RECONCILE_OR_OBSERVE',receipt_shape_consistent:false,
  independent_completion_verified:false,commercial_outcome_verified:false,
  governor_permits_issued:0
});
export function assessCompanyOutcome(input){
  if(!input || typeof input!=='object' || Array.isArray(input))
    return hold('INVALID_INPUT','structured_evidence_required');
  const {project_id,workstream_id,source,verification,commercial}=input;
  if(typeof project_id!=='string' || !PROJECT.test(project_id) ||
     typeof workstream_id!=='string' || !WORK.test(workstream_id))
    return hold('INVALID_SCOPE','registered_identity_required');
  if(!source || typeof source!=='object' || Array.isArray(source) ||
     typeof source.artifact_sha!=='string' || !SHA.test(source.artifact_sha) ||
     typeof source.ref!=='string' || !source.ref.startsWith('receipt:'))
    return hold('SOURCE_EVIDENCE_MISSING','artifact_receipt_required');
  if(!verification || typeof verification!=='object' || Array.isArray(verification) ||
     verification.project_id!==project_id ||
     verification.workstream_id!==workstream_id ||
     verification.artifact_sha!==source.artifact_sha ||
     verification.result!=='PASS' ||
     typeof verification.receipt_ref!=='string' ||
     !verification.receipt_ref.startsWith('receipt:'))
    return hold('AWAITING_VERIFIER_RECEIPT','exact_project_workstream_and_sha_required');
  const commercialShape = commercial && typeof commercial==='object' &&
    !Array.isArray(commercial) &&
    commercial.currency==='CAD' &&
    Number.isSafeInteger(commercial.collected_cash_cents) &&
    commercial.collected_cash_cents>0 &&
    commercial.settlement_verified===true &&
    typeof commercial.provider_receipt_ref==='string' &&
    commercial.provider_receipt_ref.startsWith('receipt:');
  const requiresCash = commercial!==undefined && commercial!==null;
  return {
    schema:COMPANY_OS_EVIDENCE_GATE_VERSION,
    state:requiresCash && !commercialShape ? 'CASH_EVIDENCE_INCOMPLETE'
         : 'RECEIPT_CLAIM_READY_FOR_INDEPENDENT_VERIFIER',
    reason:'untrusted_receipt_metadata_only',
    next_action:'VERIFY_RECEIPT_SIGNATURE_AND_PROVENANCE',
    receipt_shape_consistent:true,
    commercial_claim_shape_consistent:requiresCash ? Boolean(commercialShape) : null,
    independent_completion_verified:false,
    commercial_outcome_verified:false,
    governor_permits_issued:0
  };
}
