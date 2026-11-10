# Earnloop Company OS — dedicated product execution

## Topology
Earnloop browser → Earnloop Web API → PostgreSQL
                                ↘ product Company OS work queue → permitted deterministic executor → evidence receipt
Sina Founder OS ← approved strategic summary/exception; NOT product code and NOT a second ledger.

This is a product-specific Company OS, not a separate competing general-purpose agent registry or a deployment of Paperclip. Product-specific role definitions and authority are in `src/company-os/policy.mjs`; WorkPackets, audit receipts, KPI snapshots, and runner are in `engine.mjs`. After a real partner is approved, its offerwall adapter can be added behind authenticated, rate-limited partner-specific callbacks.

## Actual operating loop
The web service runs an idempotent 15-minute tick. It creates three WorkPackets per UTC day:
- revenue snapshot (actual DB numbers)
- trust audit (partner event status; not money movement)
- growth diagnosis (activation/referral funnel from members)

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
