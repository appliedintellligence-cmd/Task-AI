# Frontend production authentication

## Current deployment source

The Vercel `task-ai` project must deploy production from the GitHub `main`
branch. Its project root must be `frontend`.

Required Vercel project settings:

- Git repository: `appliedintellligence-cmd/Task-AI`
- Production branch: `main`
- Root Directory: `frontend`
- Framework preset: Vite
- Install command: `npm install` (or the Vercel default)
- Build command: `npm run build`
- Output directory: `dist`

The active production alias observed during this change was:

- `https://task-ai-navy.vercel.app`

If a custom production domain replaces that alias, add the equivalent exact
URLs for the custom domain everywhere below before switching traffic.

## Vercel environment variables

Set all three variables for Production and for any Preview environments used to
test authentication:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` — the HTTPS Render API origin, without a trailing slash

Only `VITE_` variables are available to browser code. Never configure
`SUPABASE_SERVICE_KEY`, a Google client secret, or any backend provider secret
in Vercel frontend variables.

After changing environment variables, create a new deployment because Vite
embeds public configuration at build time. In Vercel, open the latest
production deployment, choose **Redeploy**, disable **Use existing Build
Cache**, and confirm the redeploy.

For project `qfgeaayofzjnvblbgywd`, the production value of
`VITE_SUPABASE_URL` must be:

```text
https://qfgeaayofzjnvblbgywd.supabase.co
```

Copy the public anon key from **Supabase → Project Settings → API** into
`VITE_SUPABASE_ANON_KEY`. Do not use the service-role key. Set `VITE_API_URL`
to the public HTTPS origin of the Render backend; it is used only for Task AI
API requests and is not involved in email registration or Supabase OAuth.

## Registration troubleshooting

The Register form calls `supabase.auth.signUp` directly from the browser. It
does not call Render. In the browser developer console, a registration attempt
should identify this public endpoint without printing the submitted account
details or any credentials:

```text
https://qfgeaayofzjnvblbgywd.supabase.co/auth/v1/signup
```

If registration reports that it cannot reach the service, verify the two
`VITE_SUPABASE_*` production variables and redeploy without the build cache.
If Supabase returns a structured Auth error, address that message in
**Authentication → Providers → Email** or the relevant Auth settings. Confirm
that email signup is enabled and review Supabase Auth logs for the failed
request. Do not rebuild Render for a direct Supabase registration failure.

## Supabase Auth URL configuration

For the current production alias, configure:

- Site URL: `https://task-ai-navy.vercel.app`
- Redirect URL: `https://task-ai-navy.vercel.app/**`

For local development, configure:

- Redirect URL: `http://localhost:5173/**`

These entries cover the app's `/auth/callback` and `/reset-password` routes.
Add a separate redirect pattern for every intentionally supported custom or
preview origin; do not add unrelated origins.

Under **Authentication → Providers → Google**:

1. Enable Google.
2. Enter the Google OAuth web client ID and client secret.
3. Save the provider configuration.

For production project `qfgeaayofzjnvblbgywd`, the Supabase callback URL is:

```text
https://qfgeaayofzjnvblbgywd.supabase.co/auth/v1/callback
```

The error `Unsupported provider: provider is not enabled` is resolved by these
Supabase provider settings. It cannot be fixed by changing the frontend OAuth
call.

Do not use the Vercel `/auth/callback` URL as Google Cloud's redirect URI.
Google returns to Supabase first; Supabase then returns to Task AI.

## Google Cloud OAuth client

Use a **Web application** OAuth 2.0 client. Configure:

- Authorized JavaScript origin: `https://task-ai-navy.vercel.app`
- Authorized redirect URI:
  `https://qfgeaayofzjnvblbgywd.supabase.co/auth/v1/callback`

The redirect URI must exactly match the callback displayed by Supabase. Ensure
the OAuth consent screen is published for production, or add intended accounts
as test users while the app remains in testing mode.

## Render API configuration

The frontend authenticates with Supabase and passes the resulting access token
to Render. Set Render's `CORS_ALLOWED_ORIGINS` to include the exact frontend
origin:

```text
https://task-ai-navy.vercel.app
```

Add custom domains explicitly. Do not use `*` with authenticated endpoints.

No Render rebuild is required for the current Google-provider-not-enabled
error. Rebuild Render only when backend code or backend environment variables
change.

## Git merge and production deployment

The historical feature and earlier authentication branches are already merged
and behind `main`; merging them again will not deploy newer code. For this
hardening change, use a pull request from
`fix/google-oauth-production-hardening` into `main`:

```bash
git switch fix/google-oauth-production-hardening
git add frontend/src/pages/AuthCallback.jsx \
  frontend/src/lib/authDeployment.test.js \
  docs/frontend-auth-production.md
git commit -m "fix: harden production Google OAuth callback"
git push -u origin fix/google-oauth-production-hardening
gh pr create --base main --head fix/google-oauth-production-hardening \
  --title "Harden production Google OAuth callback"
gh pr checks --watch
gh pr merge --merge
```

Pushing the merge to `main` triggers the configured Vercel production build.
Verify `/auth/callback` directly, then test Google success, Google denial,
email/password login, logout, and password recovery on the production origin.
