# Earnloop Operations Site — production implementation

Created 2026-11-11. Canonical source: this repo. Public routes: / (original growth product), /earn (member offer discovery), /operations (private operating Site), /company-os (existing canonical Company OS console).

## Exact operational scope

- /operations authenticates with existing COMPANY_OS_ADMIN_TOKEN; the token stays in page memory, never localStorage.
- The server creates product-isolated PostgreSQL operational tables at boot, reusing real members, external-source postbacks, financial journal, support, sponsor leads and Company OS WorkPackets.
- /earn shares the existing HttpOnly member session el_session. Visible manual listings require real HTTPS terms, destination and publisher/sponsor approval reference. Actual Torox hosted sessions require configured publisher credentials.
- Click/start interactions are idempotently recorded and velocity-flagged. No participation event creates a spendable monetary balance.
- The operations surface supports provider onboarding, member qualification, offer creation and publication, transactions, risk review, reward ledger, redemption-interest intake, support, sponsor leads, cost/evidence intake and experiment Tracks A–D.
- All manually attached transaction evidence/cost records remain classified operator_reported; no operator action can promote them to independently verified cash.
- Redemption interest is never a funded claim or payment execution. There is no fake wallet or payout.
- Department views cover growth, partnerships, trust, revenue, engineering and verification. WorkPackets still dispatch to the existing Company OS registry and existing receipt engine.
- Torox publisher_payout_reported_usd is reported publisher net payout, not advertiser gross. Provider fees embedded upstream must not be deducted twice. Legacy partner events lack an explicit verified currency, so the margin remains unknown.

## New HTTP interfaces

| Route | Method | Access | Effect |
|---|---|---|---|
| /operations | GET | Page public, API admin-protected | Private operator Site |
| /api/company-os/operations | GET | Admin bearer token | Live database readback |
| /api/company-os/operations | POST | Admin bearer token + same origin | Typed changes with audit records |
| /earn | GET | Public | Member offer discovery |
| /api/earn/offers | GET | Public | Operator-published real-source offers |
| /api/earn/track | POST | Member cookie + same origin | Idempotent click/start event |
| /api/earn/redemptions | GET | Member cookie | Unfunded request history |
| /api/earn/redemption-request | POST | Member cookie + same origin | Explicitly acknowledged unfunded interest |

## Economics and proof

Source-reported revenue minus provider share, user reward, referral, processing, fulfillment, acquisition, reversal and support. Monetary amounts use integer currency minor units. Any missing cost, currency or currency mismatch yields unknown margin. Even a complete reported-only schedule is provisional and never independently verified profit.

The first-positive-margin proof board requires real provider-approved inventory, member attribution, authenticated conversion and reversal evidence, collectible and bank-reconciled cash, actual cost schedule, reward funding and fulfillment receipt. Work receipts, source-reported conversions and operator-entered URLs are not cash collection.

## Deployment and next actual external actions

Uses the existing Earnloop Railway web service and PostgreSQL, no new credentials required for the Site. CI includes unit checks, isolated browser verification and read-only production smoke. Torox, BitLabs, ayeT and Tremendous acceptance, actual settlement, and payout-rail credentials are not provisioned by implementing this UI. To complete the first profit proof, obtain actual publisher terms and credentials, real attributable conversion, cash-reconciliation evidence, and funded fulfillment. Only then add a narrow payment executor referencing independently reconciled available balances.
