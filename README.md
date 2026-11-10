# Earnloop — independent product + dedicated Company OS

Revenue-first community rewards platform, copied from proven offerwall / quest / affiliate business mechanics. **This is a separate product, not the Sina Founder OS application.**

## Exact source acquisition / execution

[**Execution Order v1 — what to copy, clone, integrate and ship**](docs/EXECUTION-ORDER-v1.md) is the operational WorkPacket aligned with the existing Sina Founder Goal. The current codebase is **this repo**, not a second app in the Founder OS repo. Use canonical product Company OS tasks to execute scoped work, not a new scheduler or a duplicate store.

### Torox publisher-gated integration

The code includes src/torox.mjs, GET /api/offerwall/status, GET /api/offerwall/session, GET /api/partner/torox/postback and an idempotent reported-only Postgres table. Activation requires actual publisher approval and TOROX_PUBLISHER_APPROVED=true, TOROX_APPROVAL_REFERENCE, TOROX_PLACEMENT_ID, TOROX_APP_TOKEN (server-only), TOROX_MODE=staging or production. Approval, supported incentivized geography, callback IP/network conditions, reversal handling, cash settlement and funded redemption remain commercial onboarding gates. Do **not** put bogus approval values in Railway or claim the wallet is live.

## Build state
- Responsive founding-member website with signup, session-based member account, XP and leaderboard, consented waitlist, personal referrals.
- Compatible with current Earnloop production PostgreSQL tables and private sessions.
- Dedicated Company OS with 8 business roles, typed WorkPackets, DB-backed runner, idempotent daily missions, evidence receipts and password-protected internal operator console.
- External cash rewards and real advertiser campaigns intentionally disabled until a signed contract, verified callbacks and funded payout rails exist.

## Get started
`npm install && npm run verify`

Run: `DATABASE_URL=postgresql://... COMPANY_OS_ADMIN_TOKEN=... npm start`

Production: Railway Node 22, connect existing Postgres and deploy from repo root. Do not expose secrets. `railway.json` included.

## Operating constraints
Community XP is non-cash. Signed advertiser events are **reported**, not settled. Company OS receipt hashes are only local-integrity checks. Verified revenue and money movement require independent evidence and a completed cash settlement path.

See `docs/FOUNDER-GOAL.md`, `docs/COMPANY-OS.md` and `docs/MIGRATION.md`. Work remains to secure an advertiser, confirm Canadian inventory, build its specific adapter and verify payment/payout flows.

## Publish to the product's own GitHub repository
Canonical product repository: `Noetfield-Systems/Earnloop`. Railway source must point to its `main` branch and root directory `/`. Keep the existing PostgreSQL volume, database connection, member sessions, and public domain unchanged.
