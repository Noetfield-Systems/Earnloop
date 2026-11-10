# Zero-destructive migration from Sina Founder OS into an independent repository

Current deployed app source: `Noetfield-Systems/sina_founder_os/apps/earnloop`, branch main.
Current Railway project: `noetfield-earnloop`, service `earnloop-web` and retained `Postgres` with persistent volume.

## Migration plan
1. Use the existing GitHub repository `Noetfield-Systems/Earnloop` (currently public). Do not add secrets, token values, member data or proprietary credentials to the repository.
2. Push the complete contents of this project to its `main` branch. `npm run verify` must pass.
3. In Railway project `noetfield-earnloop`, preserve `Postgres`, its mounted volume and all existing variables. Do not recreate the database and do not expose its DATABASE_URL publicly.
4. In `earnloop-web`, set Root Directory from `/apps/earnloop` to `/` and change the linked GitHub Source to `Noetfield-Systems/Earnloop`, main. The source switch must deploy the *new* repository. Keep the existing public domain.
5. Add `COMPANY_OS_ADMIN_TOKEN` (32+ cryptographically random characters) as a private Railway service variable. Do not change the member session cookie name or database.
6. Confirm fresh deployment SUCCESS, `/health` returns connected, public signup/referral/check-in endpoints operate, and `/company-os` can load authorized operational figures. Compare member counts before/after.
7. Once operating reliably from standalone repo, remove only the obsolete product subdirectory from Sina Founder OS via a separate reviewed PR. Leave a link to the new repository and strategic interface contract in Sina. **Do not delete the Earnloop Railway service or database.**

## Rollback
If the new Railway deployment fails, preserve the last successful deployment and reconnect `earnloop-web` to `Noetfield-Systems/sina_founder_os`, main, root `/apps/earnloop`. Avoid changing data or rewriting tables.

## Compatibility constraints
The new server reuses `earnloop_members`, `earnloop_waitlist`, `earnloop_partner_events`, `el_session` cookie, token_hash and existing member referral codes. It creates only two additional tables prefixed `earnloop_os_`. This is a compatible **reimplementation** of the early beta, not a byte-identical copy of the old web site; test the cutover against a real session.
