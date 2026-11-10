# SINA / COMPANY OS — EXACT EXECUTION ORDER: EARNLOOP PROVEN-MODEL REPLICATION

Date: 2026-11-09 (Vancouver). Scope: existing project Noetfield-Systems/Earnloop. This is subordinate to integrations/founder-brain/FOUNDER-CONTEXT-PROFILE-v1.md, section 2A. Do not create a second Founder Goal, Company OS, task registry, company entity, or scheduler.

## REASON

Founder wants the fastest credible route from little initial capital to REAL users, repeatable advertiser/merchant-funded transactions, payable rewards, referrals, net-positive collected revenue and low-Founder-touch growth. Copy proven economic MECHANISMS instead of inventing concepts. Default first candidate: Freecash + Reward XP + LootUp game/offer earnings combined with Zealy-style community quests and, later, Fluz-style merchant-funded gift-card commerce. Still compare genuinely faster paid models and stop unprofitable work. Successful market share/revenue of competitors is not proof our economics will work.

## GOAL

Operate one premium mobile-first Earn/Play/Quest/Invite product under the EXISTING Earnloop service on Railway (project noetfield-earnloop; earnloop-web + PostgreSQL). First prove a provider-accepted, attributable, legitimately collected payable conversion, then a funded user redemption and positive contribution after all costs. Registration, XP, fake conversions, screenshots, and pending receivables are NOT cash.

## EXACT SOURCE MAP — CHOOSE, CLONE, PORT, INTEGRATE

1. KEEP/EXTEND our own product:
   https://github.com/Noetfield-Systems/Earnloop
   Files: server.mjs, public/index.html, public/style.css, public/app.js, existing PostgreSQL tables and referral/check-in engine. These are canonical. Do NOT fork a new application or rewrite the functioning database/auth first.

2. BENCHMARK ONLY — Freecash, Reward XP, LootUp, Scrambly:
   https://freecash.com ; https://rewardxp.com ; https://lootup.me ; https://scrambly.io
   Copy FUNCTIONAL MECHANICS: game offer listing, milestones, qualification details, pending/approved/reversed UX, payout education, invite links, streak/leaderboards, complaint resolution. Their proprietary source, logos, screenshots, designs, names and marketing text are NOT licensed for copying. No scraping campaign inventory or pretending to be an official partner.

3. OPTIONAL LICENSED UI MODULE PORT, NOT WHOLE APP MIGRATION:
   https://github.com/nextjs/saas-starter at pinned commit 6e33e58b1e553a41fe22e6b941a7229a002de361
   Verified MIT LICENSE. Exact files for reference/port: app/(dashboard)/layout.tsx, app/(dashboard)/dashboard/page.tsx, components/ui/card.tsx, button.tsx, avatar.tsx, input.tsx, app/globals.css. Retain MIT notices; do not deploy a parallel Next app. Only port selected layout ideas/components if a single deliberate migration makes delivery faster. Existing Earnloop plain JS is still the production owner.

4. ALTERNATE UI/SEO REFERENCE (do not adopt TWO starters):
   https://github.com/ixartz/Next-js-Boilerplate at commit b83157a8018f55b926a3c25a4b7a7e14b0dfbc35
   Verified MIT LICENSE. SEO patterns: src/app/robots.ts, src/app/sitemap.ts, CI/browser QA conventions. Reuse small permissively licensed portions only after checking dependencies; prefer P0 product delivery to framework migration.

5. QUEST SERVER LOGIC REFERENCE — licensing caveat:
   https://github.com/piyushdotcomm/lifequest at commit ab402ea7c32c44d5b00c5ea43c7b133dfd956ab8
   Review supabase/migrations/0003_engine.sql and 0005_recurrence_achievements_anti_farm.sql plus src/components/quest-board.tsx. README mentions MIT but no root LICENSE file could be confirmed. DO NOT copy code until licensing is cleared. Earnloop already does real, once-daily Postgres XP checks; adapt only demonstrably useful patterns for anti-double-credit/streaks.

6. COMMERCIAL INVENTORY — API, NOT CODE FORK:
   https://torox.io/publisher-integration-guide/
   Existing integration code: src/torox.mjs. Once actual publisher approval and contract terms exist, use Torox hosted session via POST https://api.wall.torox.io/partner/session with placement_id and server-only token; render returned approved Torox wall URL to logged-in member. Handle signed conversion/reversal source reports through GET /api/partner/torox/postback. Torox-reported amount is placement currency, payout is source-reported publisher revenue. No auto cash credit or reported-as-collected accounting.
   TOROX_PUBLISHER_APPROVED, TOROX_APPROVAL_REFERENCE, TOROX_PLACEMENT_ID, TOROX_APP_TOKEN and TOROX_MODE must be configured after permission. Never invent credentials.
   Alternative supplier: https://developer.bitlabs.ai/docs/getting-started and https://developer.bitlabs.ai/docs/callbacks only if partner acceptance/geo/terms are favorable.

7. REDEMPTION API — only once funded:
   https://www.tremendous.com/gift-card-api
   Integrate delivery API when legally available and prepaid/supported; gift-card face value is not free. No unbacked wallet and no made-up balance.

8. MERCHANT COMMERCE — only after first profitable earn/redeem:
   https://github.com/medusajs/medusa . Core open-source MIT; enterprise modules have separate terms. Select only necessary gift/order modules if existing Stripe/app cannot fulfill validated merchant-funded opportunity. Do not deploy another whole commerce system prematurely.

## REPRODUCIBLE CLONE COMMANDS (REFERENCE WORKTREES ONLY)

~~~sh
git clone --filter=blob:none https://github.com/nextjs/saas-starter.git /tmp/earnloop-ui-saas-reference
git -C /tmp/earnloop-ui-saas-reference checkout 6e33e58b1e553a41fe22e6b941a7229a002de361
git clone --filter=blob:none https://github.com/ixartz/Next-js-Boilerplate.git /tmp/earnloop-seo-reference
git -C /tmp/earnloop-seo-reference checkout b83157a8018f55b926a3c25a4b7a7e14b0dfbc35
# Selectively port only clearly licensed needed files; preserve license notices.
# Never overwrite Earnloop auth, Postgres, referrals, session or existing Railway app.
~~~

## TASKS — SHIP, DON'T BRAINSTORM FOREVER

P0 PRODUCT NOW: Keep working Earnloop free signup, real member stats, referral codes, check-in, XP, leaderboard, waitlist. Improve mobile UX into premium Earn/Play/Quests/Invite experience, clearly marking unavailable paid offers. Use hosted Torox integration and a real partner approval gate instead of building a new Offerwall. Do not fake games, users, cashout or affiliate revenue.

P1 FIRST MONEY: Obtain real Torox publisher acceptance and eligibility for Canada, web app, incentivized placements, conversion callbacks, reversals, fraud controls, settlement cadence and payout minimum. If rejected, work BitLabs. Implement provider-specific receipt reconciliation and a FUNDED reward ledger only after approval. A callback is UNSETTLED SOURCE DATA. First prove payable partner-approved action, actual collection, legitimate fulfilled user reward and positive realized contribution margin.

P2 FREE GROWTH: Founding member badge (genuine first 500, noncash status), seven-day community quest, permitted SEO game guides, creator collaborations, referral links rewarding QUALIFIED activity only, no spam or incentivized affiliate policy violations. Track real signups -> retention -> partner-approved action -> collected money -> funded reward -> repeat / qualified referral. Never pay users solely for recruiting.

P3 ALTERNATIVE FIRST DOLLAR: If offers are blocked, test an approved affiliate content/discovery funnel with transparent disclosure or one paid, sponsor-funded community quest. Do not promise redemption until money funds it. Continue research on proven gift-card gifting, cashback, digital microcommerce, discount/resale, and legal prize experiences, but do not split into ten simultaneous products before cash proof.

P4 LATER ONLY: Merchant-paid repeat-purchase and gifting with gift-card provider, only if contract economics and refunds work. No DEX, investment promise, speculative token, deposit-funded prize-box or complex wallet required for MVP.

## AUTHORITY / DELIVERY

Sina Founder OS: select proven economics and rank by fastest realistic collectible revenue/working capital, acquisition cost, real paid action and contribution margin. Reuse the single Founder Goal. Existing Company OS: Product builds, Growth acquires, Revenue obtains qualified commercial counterparties, QA verifies independent artifacts. Use only approved existing workpackets/governor/receipt paths; do not fabricate external permits.

Founder human approval remains needed for provider contracts, spend, publication, legal promises and funding rewards. Deliver open PR/commit SHA, Railway release state, authentic user metrics and provider receipts. Never substitute "tests passed" for real customer/partner payment.

## REPORT AND STOP RULE

Report one succinct control-plane brief: NOW / MONEY / MOVING / RISKS / DECISIONS / RESULTS. Each result needs a real user or supplier event and independent proof, not synthetic QA. Stop any redeemable reward when funding, attribution, reversal reserve, supplier acceptance, settlement or fraud controls are unknown. No fake member counts, no fake paid offer, no token-price story. First actual collected net-positive dollar is the victory condition.
