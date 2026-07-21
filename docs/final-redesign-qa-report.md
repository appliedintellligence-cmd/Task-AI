# Task AI production-readiness QA report

Date: 2026-07-21 (Australia/Melbourne)
Branch: `feature/task-ai-ux-safety-redesign`

## Recommendation

**READY WITH CONDITIONS**

The audited code blockers are remediated locally. Production remains conditional
on staging migration rehearsal, production data/storage inventory, backups and
manual verification of Vercel, Render, Supabase Auth and CORS dashboard state.
No remote migration or service change was made during remediation.

## Remediations

1. Database rollout uses an additive corrective expand migration. Legacy RPC
   signatures are secure empty-result compatibility shims; owner-scoped RPCs
   remain functional. The destructive contract step is isolated under
   `db/post_deployment`.
2. New repair photos require authentication, use unpredictable owner/job paths
   in a private bucket, persist `photo_path`, and receive five-minute signed URLs
   only after job ownership verification. Existing HTTPS image URLs have a
   temporary read-only dual-read path and a non-destructive conversion runbook.
3. `/reset-password` now validates Supabase recovery sessions, passwords and
   confirmation, handles expired links and supports direct Vercel navigation.
4. NumPy/OpenCV are pinned to a Python-3.11-compatible pair and Render's Python
   requirement is declared.
5. Render branch, health check, start command and auto-deploy intent are explicit;
   Vercel SPA rewrites and environment-only mobile configuration are present.

## Automated results

| Gate | Result |
|---|---|
| Clean Python 3.11 dependency install | Passed |
| Clean backend application import | Passed |
| Backend tests | 161 passed; one upstream deprecation warning |
| Authorisation/storage/migration tests | Included in backend suite |
| Web tests | 42 passed |
| ESLint | Not configured; the former test-backed `lint` alias was removed |
| Web production build | Passed; plugin deprecation and >500 kB chunk advisories |
| Mobile TypeScript | Passed |
| Mobile tests | 2 security/configuration contract tests passed |
| Diff hygiene | `git diff --check` passed |
| Secret scan | Passed for tracked current-tree configuration; synthetic test credentials excluded by design |

## Required migration order

Expand stage:

1. `db/migrations/20260718_add_profile_jurisdiction.sql`
2. `db/migrations/20260718_add_job_safety_assessment.sql`
3. `db/migrations/20260718_enforce_private_record_ownership.sql`
4. `db/migrations/20260721_expand_deployment_compatibility.sql`
5. `db/migrations/20260721_add_private_repair_photos.sql`

If step 3 has not already run, apply steps 3 and 4 atomically. Then deploy and
verify the backend and web application. Only afterward, in a separate approved
window, apply:

- `db/post_deployment/20260721_contract_remove_legacy_rpcs.sql`

The contract migration must not be included in an automatic migration run.

## Manual conditions

- Rehearse the full expand/deploy/contract sequence against a production-like
  staging copy and measure locks/runtime.
- Inventory production jobs and storage before converting existing images;
  follow `docs/existing-photo-migration-runbook.md` and do not delete originals.
- Confirm dashboard state listed in `docs/production-rollout.md`.
- Back up database data/schema, functions/grants, RLS, auth configuration,
  storage metadata and object bytes.
- Complete staging browser/device camera, recovery, ownership, signed-URL,
  safety-level and rollback smoke tests.

## Rollback

Before contract, roll back web/backend deploy artifacts while leaving additive
columns and the secure compatibility shims in place. After contract, recreate
the secure empty-result shims before restoring the old backend. Never restore
cross-user RPC behavior. Keep the private bucket private. Private-photo rollback
uses the conversion manifest to clear converted row paths while retaining copied
objects and legacy URLs; it does not delete or publicize storage.

## Known non-blocking limitations

- Victoria remains the only policy-verified jurisdiction; other jurisdictions
  correctly remain policy-unverified and instruction-locked.
- Guided progress is device-local.
- No automated mobile component/device, visual-regression or screen-reader suite
  is configured; mobile contract tests cover signed-photo refresh and environment-only configuration.
- Vite reports plugin deprecation and bundle-size advisories.
