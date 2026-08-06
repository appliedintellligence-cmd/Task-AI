# Controlled production rollout

Never run the contract migration as part of the expand stage. Never apply these
files to an unconfirmed database target.

## Database order

### Completely empty staging project

Apply these files one at a time in this exact order:

1. `db/schema.sql`
2. `db/migrations/20260718_add_profile_jurisdiction.sql`
3. `db/migrations/20260718_add_job_safety_assessment.sql`
4. `db/migrations/20260721_expand_deployment_compatibility.sql`
5. `db/migrations/20260718_enforce_private_record_ownership.sql`
6. `db/migrations/20260721_add_private_repair_photos.sql`
7. `db/migrations/20260722_fix_messages_halfvec_index.sql`
8. `db/migrations/20260806_fix_registration_profile_trigger.sql`

The compatibility expand migration precedes the ownership migration only for a
clean database because the ownership migration revokes the legacy RPC
signatures. A clean baseline does not otherwise contain those signatures. The
final corrective migration idempotently recreates the supported
`halfvec(3072)` expression index and the matching owner-scoped RPC. Do not run
the post-deployment contract migration during staging bootstrap.

### Existing database expand rollout

1. Back up the database, function grants, RLS policies, auth configuration and
   storage metadata.
2. On staging, apply `20260718_add_profile_jurisdiction.sql`, then
   `20260718_add_job_safety_assessment.sql`, then
   `20260718_enforce_private_record_ownership.sql`, followed immediately by
   `20260721_expand_deployment_compatibility.sql`. If the 20260718 ownership
   migration has not previously run, apply it and the corrective expand
   migration in one database transaction so the secure compatibility shims are
   restored atomically.
3. Verify both API generations: the legacy RPC signatures must execute but
   return no rows, while owner-scoped RPCs must return only owner records.
4. Apply `db/migrations/20260721_add_private_repair_photos.sql`, then verify the
   bucket remains private and has no anon/authenticated direct-access policy.
5. Apply `db/migrations/20260722_fix_messages_halfvec_index.sql` and verify that
   `match_messages_for_user` remains owner-scoped and accepts `vector(3072)`.
6. Apply `db/migrations/20260806_fix_registration_profile_trigger.sql`, then
   create a disposable test account through Supabase Auth and verify that
   exactly one matching `public.profiles` row is created. The migration does
   not modify existing users or profiles.
7. Apply the same expand sequence in the controlled production change window.
8. Deploy and verify the new backend, then the web application.
9. Only after the previous backend no longer receives traffic, manually apply
   `db/post_deployment/20260721_contract_remove_legacy_rpcs.sql`.

The legacy compatibility functions deliberately return empty sets. This keeps
the previous backend available without restoring cross-user similarity search.
The active embedding implementation returns no embeddings, so this does not
remove a currently functional recommendation path.

## Rollback boundary

Before the contract migration, application rollback is safe because both RPC
generations exist. After contract, the old backend must not be restored unless
the secure empty-result compatibility shims from the expand migration are
recreated first. Additive nullable columns should remain during rollback.

## Supabase authentication redirects

The complete frontend OAuth configuration is documented in
`docs/frontend-auth-production.md`.

Set the Supabase Site URL to the canonical production web origin. Add exact
redirect allow-list entries for both the production and staging origins:

- `https://<production-origin>/`
- `https://<production-origin>/reset-password`
- `https://<staging-origin>/`
- `https://<staging-origin>/reset-password`

Add only intentionally supported preview URL patterns. Google OAuth returns to
the web origin through Supabase's provider callback. Verify direct navigation
and refresh of `/reset-password`; `frontend/vercel.json` rewrites application
routes to the SPA entry point.

## Manual deployment dashboard checks

Repository configuration is not proof of live dashboard state. Before merging:

- Vercel: confirm the connected project root is `frontend`, production branch
  is `main`, production/preview variables are scoped correctly, and automatic
  deployments are paused for the controlled rollout.
- Render: confirm the service is linked to `main`, Python 3.11.11 is selected,
  `/health` is the health check, the start command matches `render.yaml`, and
  automatic deployments are off. `render.yaml` expresses this intent but may
  not override an existing service's dashboard configuration.
- Supabase: confirm Site URL and redirect allow-list entries above, Google OAuth
  callback configuration, the private bucket state, and storage/RLS policies.
- CORS: set `CORS_ALLOWED_ORIGINS` to the exact canonical production and
  explicitly approved staging web origins, comma-separated with no paths or
  trailing slashes. Do not use a wildcard.

## Environment variable names

Render: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`,
`CORS_ALLOWED_ORIGINS`.

Vercel: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Expo: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. A service-role key must never be used in a
browser or mobile variable.
