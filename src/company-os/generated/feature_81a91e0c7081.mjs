/**
 * Earnloop provider credit readiness: data-only policy helper.
 * An advertiser-reported offer is never proof of collected cash.
 * This function cannot issue credits, payouts or revoke a settlement.
 */
export function evaluateRewardCreditReadiness(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { state: 'INVALID_INPUT', creditReady: false, payoutReady: false };
  }
  const { publisherApproved, callbackVerified, reversalPending,
          settledGrossCents, rewardLiabilityCents, cashIndependentlyVerified } = input;
  if (!Number.isSafeInteger(settledGrossCents) ||
      !Number.isSafeInteger(rewardLiabilityCents) ||
      settledGrossCents < 0 || rewardLiabilityCents < 0 ||
      rewardLiabilityCents > settledGrossCents) {
    return { state: 'INVALID_ACCOUNTING', creditReady: false, payoutReady: false };
  }
  if (publisherApproved !== true) {
    return { state: 'PUBLISHER_NOT_APPROVED', creditReady: false, payoutReady: false };
  }
  if (callbackVerified !== true) {
    return { state: 'PARTNER_CALLBACK_UNVERIFIED', creditReady: false, payoutReady: false };
  }
  if (reversalPending !== false) {
    return { state: 'REVERSAL_REVIEW', creditReady: false, payoutReady: false };
  }
  if (cashIndependentlyVerified !== true) {
    return { state: 'CASH_UNVERIFIED', creditReady: false, payoutReady: false };
  }
  return { state: 'REVIEW_ELIGIBLE', creditReady: true, payoutReady: false };
}
