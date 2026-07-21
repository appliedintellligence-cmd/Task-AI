# Controlled production rollout

Never run the contract migration as part of the expand stage. Never apply these
files to an unconfirmed database target.

## Database order

1. Back up the database, function grants, RLS policies, auth configuration and
   storage metadata.
2. On staging, apply the existing 20260718 migrations followed immediately by
   `db/migrations/20260721_expand_deployment_compatibility.sql`. If the
   20260718 ownership migration has not previously run, apply it and the
   corrective expand migration in one database transaction so the secure
   compatibility shims are restored atomically.
3. Verify both API generations: the legacy RPC signatures must execute but
   return no rows, while owner-scoped RPCs must return only owner records.
4. Apply the same expand sequence in the controlled production change window.
5. Deploy and verify the new backend, then the web application.
6. Only after the previous backend no longer receives traffic, manually apply
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
