# Earnloop Company OS — dedicated product execution

## Topology
Earnloop browser → Earnloop Web API → PostgreSQL
                                ↘ product Company OS work queue → permitted deterministic executor → evidence receipt
Sina Founder OS ← approved strategic summary/exception; NOT product code and NOT a second ledger.

This is a product-specific Company OS, not a separate competing general-purpose agent registry or a deployment of Paperclip. Product-specific role definitions and authority are in `src/company-os/policy.mjs`; WorkPackets, audit receipts, KPI snapshots, and runner are in `engine.mjs`. After a real partner is approved, its offerwall adapter can be added behind authenticated, rate-limited partner-specific callbacks.

## Actual operating loop
The web service runs an idempotent 15-minute tick. It creates four WorkPackets per UTC day:
- revenue snapshot (actual DB numbers)
- trust audit (partner event status; not money movement)
- growth diagnosis (activation/referral funnel from members)
- replication launch check (evidence-constrained next commercial decision)

`createWork` requires a type, an objective and a unique idempotency key. PostgreSQL is the single source of truth. A transaction using `FOR UPDATE SKIP LOCKED` claims one WorkPacket at a time. The runner accepts only `auto/read_only` or `auto/draft_only` tasks. A JSON evidence result and SHA-256 digest are attached to a completed packet. The digest checks local consistency, **not independent third-party verification**.

## Authority
- Automatic: read-only business intelligence, trust audit, growth diagnosis, unsent partner outreach draft.
- Needs Founder approval and additional verified execution infrastructure: paid campaigns, member cash payouts. These are recorded as `awaiting_approval`; there is **no** code path that executes them.
- Vendor approval, chargebacks, payout eligibility, member identity checks and tax handling must be implemented before offering withdrawable rewards.

## Growth company functions
- CEO / strategy: priorities and exceptions.
- Revenue: gross, payable, rewards, contribution profit, funding verification.
- Growth: activation, retention, referrers, compliant acquisition.
- Partnerships: Torox/ayeT/other publisher applications, supply contracts, callback requirements.
- Community: valid quests, creator programs, culture, genuine members.
- Trust: fraud, duplicates, reversals, disputes.
- Engineering: production deploys, health, integrations.
- Verification: third-party receipts and external confirmations in a future integration.

## Revenue gate
An event reported by a partner is not a settled payout or a real cash receipt. The current API stores signed postbacks as `reported` only. No cash wallet, no withdrawal, no purchased gift cards, no crypto yield, no simulator disguised as production. To unlock commercial rewards: secure publisher acceptance, implement the exact partner signature/attribution/reversal spec, verify receivables and finance rewards from cleared funds, add user verification and payout rails, then run one actual funded payout under Founder-approved policy.

## Internal endpoints (admin token required)
- `GET /api/company-os/overview` — actual KPIs, WorkPackets, receipt digests, role policies.
- `POST /api/company-os/work` — typed work creation, idempotent.
- `POST /api/company-os/run` — execute next permitted work.
- `/company-os` — operator interface (token used for requests, not persisted).

Admin token must be at least 32 characters, set privately as `COMPANY_OS_ADMIN_TOKEN`. Never put it in a public client bundle or git. The dashboard is not linked from the main user navigation in a fully private deployment; only authenticated APIs contain business data.

## Acceptance conditions
1. `npm run verify` passes.
2. Fresh new repository has complete product code and its own CI.
3. Railway `earnloop-web` service source is switched from Sina repo to product repo; root is `/`.
4. Existing Railway PostgreSQL volume is retained and no fresh member table replaces production data.
5. `/health` healthy; member cookie/session retains original `el_session` and SHA-256 hashing; join/check-in/referral flow manually checked.
6. Private Company OS produces at least one real KPI receipt; independent verification is separate.
7. Advertiser and cash revenue stay explicitly unverified until confirmed.

## Commercial action outbox (same PostgreSQL, no new scheduler)

`src/company-os/commercial.mjs` creates three durable, canonical prospects on startup: official Torox publisher portal, ayeT publisher/contact, and a first sponsor prospect pending a real contact. They are domain-specific commercial records, not a duplicate Company OS task registry. The private `/company-os` page and authenticated `/api/company-os/commercial` list prepared applications, exact message, channel, due follow-up and recorded evidence.

Founder approval requires a **separate** 32+ character `COMMERCIAL_FOUNDER_APPROVAL_TOKEN` (`x-founder-approval-token`). An email can be approved only against a fingerprint of its exact recipient/subject/body. Dispatch requires `RESEND_API_KEY`, a verified sender in `OUTREACH_FROM`, and the exact address in `OUTREACH_ALLOWED_RECIPIENTS`. No implicit send, mass mailing, or retry of ambiguous network failures. A successful Resend API response with a provider message ID marks `sent` (accepted for delivery), **not delivered** and not partner-approved. A 7-day follow-up becomes due for operator attention; automatic spam is disabled. Portal registration requires an actual person or authorized external browser agent to submit true details and accept any necessary terms; clicking its official link does not mark it sent.

Commercial routes under existing admin-token auth: `GET /api/company-os/commercial`, `POST /api/company-os/commercial/approve`, `/contact`, `/send`, `/evidence`. `approve` and `contact` also require the separate Founder token. Evidence entered via `/evidence` is explicitly `operator_reported` and does not flip the Torox acceptance gate or make cash appear. Production must never count drafted messages, email API acceptance, or self-reported portal tickets as independent publisher verification.
