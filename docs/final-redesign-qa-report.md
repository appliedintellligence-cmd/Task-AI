# Task AI final redesign QA report

Date: 2026-07-19 (Australia/Melbourne)
Branch: `feature/task-ai-ux-safety-redesign`

## Recommendation

**READY WITH CONDITIONS**

The local implementation passes every available automated gate and the backend remains authoritative for eligibility and instruction suppression. Deployment must wait for the manual migrations, production CORS allowlist, environment configuration, and storage-privacy decision described below.

## Automated results

| Area | Command | Result |
|---|---|---|
| Backend unit/integration/authorisation | `python3 -m pytest -q` | 145 passed |
| Web lint | `npm run lint` | Passed (project lint currently executes the complete pure-logic test suite) |
| Web tests | `npm test` | 38 passed |
| Web production build | `npm run build` | Passed; existing plugin deprecation and >500 kB chunk advisories |
| Mobile type checking | `npx tsc --noEmit` | Passed |
| Mobile tests | — | No mobile test command is configured |
| Diff hygiene | `git diff --check`, `git ls-files -u` | Passed; no conflict entries |

Coverage includes ownership/expired tokens, all four safety levels, all unresolved states, Victoria policy metadata and regulated work, unverified jurisdictions, route bypass locks, uploads/validation/duplicate submission/retry helpers, old-job reassessment, guided entry/resume/escalation, public/protected routing, result capability/preview restrictions, and CORS configuration.

## Manual checks possible in this environment

- Reviewed responsive layout constraints, safe-area padding, fixed navigation clearance, minimum primary touch targets and reduced-motion CSS.
- Reviewed result ordering and confirmed telemetry is collapsed under Diagnosis details.
- Reviewed Level 3/4/unresolved paths for hidden steps, materials, retailer links and previews.
- Reviewed frontend/mobile source for service-role credentials: none are present.
- Reviewed logs for credential-bearing output and replaced raw storage exception printing with a generic warning.
- Reviewed CORS: wildcard credentialed access was replaced by an explicit `CORS_ALLOWED_ORIGINS` allowlist with localhost-only development defaults.
- Reviewed staged/uncommitted changes for obvious credential values; only documented variable names/placeholders were found.

Device/browser interaction, camera hardware, screen-reader output and pixel screenshots at 1440/1024/768/430/390/360 could not be automated here and require pre-production device QA.

## Safety and jurisdiction status

- Levels: 1 Safe for DIY; 2 DIY with caution; 3 Professional required; 4 Emergency.
- Pending, more-information, jurisdiction-required and policy-unverified assessments use `safety_level: null` and keep instructions locked.
- Victoria is the only verified policy jurisdiction.
- ACT, NSW, NT, QLD, SA, TAS and WA remain deliberately unverified and cannot inherit Victoria rules.
- Repair severity remains separate from DIY safety level.
- Guided entry calls the authenticated backend verification endpoint before starting and after changed-condition escalation.

## Remaining defects and limitations

1. Supabase setup documentation currently describes `repair-photos` as a public bucket and the backend returns public URLs. UUID paths are difficult to guess and API ownership checks prevent cross-user listing, but bearer URL privacy is weaker than a private bucket with short-lived signed URLs. Changing this safely needs an explicitly planned storage/API compatibility migration; resolve before production use with sensitive household imagery.
2. Guided progress and Level 2 acknowledgements are versioned but device-local, not synchronised across devices.
3. The mobile project has type checking but no automated component/device test runner.
4. Web lint is a repository-defined test-backed gate; a full ESLint ruleset is not configured.
5. Vite reports the existing React OXC plugin deprecation and a roughly 599 kB minified application chunk.
6. Automated visual regression and screen-reader/device-camera testing are not configured.

## Migrations requiring manual application

Apply in a controlled Supabase change window, in this order:

1. `db/migrations/20260718_add_profile_jurisdiction.sql`
2. `db/migrations/20260718_add_job_safety_assessment.sql`
3. `db/migrations/20260718_enforce_private_record_ownership.sql`

The recorded migrations are additive/security-hardening and were not applied by this run. Back up the database, validate on staging, then verify RLS and service-role function grants.

## Environment and deployment prerequisites

Backend: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, and `CORS_ALLOWED_ORIGINS`.

Web: `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Never place the service-role key in web or mobile configuration.

Mobile currently has a compiled backend URL in `mobile/services/api.ts`; confirm the intended production endpoint during release configuration without embedding secrets.

## Rollback plan

1. Retain the previous deploy artifacts and database backup.
2. Roll back web/mobile/backend application deployments together to the last known compatible commit.
3. Do not reverse additive columns if application rollback tolerates them.
4. If owner-scoped RPCs cause an operational issue, keep legacy cross-user RPC execution revoked and restore only a reviewed owner-scoped function version.
5. Invalidate affected sessions and signed/public image URLs if an access-control incident is suspected.

## Recommended deployment order

1. Resolve and test the image-storage privacy model on staging.
2. Back up Supabase and apply the three migrations to staging.
3. Deploy backend with its production CORS allowlist and secrets.
4. Run authorisation and safety smoke tests against staging.
5. Deploy web, then mobile builds, using only public/anonymous client credentials.
6. Complete device, accessibility, camera and breakpoint QA.
7. Promote only after the conditions above are accepted.
