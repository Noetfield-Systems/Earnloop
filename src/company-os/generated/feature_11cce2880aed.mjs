/**
 * Earnloop qualified referral: a verified invitee needs both check-in and
 * daily-puzzle activity. Never grants monetary rewards or edits balances.
 */
export function assessQualifiedInvite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { state: 'INVALID_INPUT', qualified: false, cashRewardEligible: false };
  }
  const fields=['selfReferral','duplicateInvite','accountVerified',
                'checkinVerified','puzzleVerified'];
  if (fields.some(key => typeof input[key] !== 'boolean')) {
    return { state: 'INVALID_EVIDENCE', qualified: false, cashRewardEligible: false };
  }
  if (input.selfReferral) {
    return { state: 'SELF_REFERRAL', qualified: false, cashRewardEligible: false };
  }
  if (input.duplicateInvite) {
    return { state: 'DUPLICATE_INVITATION', qualified: false, cashRewardEligible: false };
  }
  if (!input.accountVerified) {
    return { state: 'ACCOUNT_UNVERIFIED', qualified: false, cashRewardEligible: false };
  }
  if (!input.checkinVerified || !input.puzzleVerified) {
    return { state: 'ACTIVITY_INCOMPLETE', qualified: false, cashRewardEligible: false };
  }
  return { state: 'QUALIFIED_NONCASH_ONLY', qualified: true, cashRewardEligible: false };
}
