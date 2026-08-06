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
embeds public configuration at build time.

## Supabase Auth URL configuration

For the current production alias, configure:

- Site URL: `https://task-ai-navy.vercel.app`
- Redirect URL: `https://task-ai-navy.vercel.app/auth/callback`
- Redirect URL: `https://task-ai-navy.vercel.app/reset-password`

For local development, add exact entries only when needed:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`

Add an exact callback/reset pair for every intentionally supported custom or
preview origin. Avoid a broad Vercel wildcard in production unless preview
OAuth is explicitly required and its access risk has been reviewed.

Under **Authentication → Providers → Google**:

1. Enable Google.
2. Enter the Google OAuth web client ID and client secret.
3. Copy the Supabase callback URL shown on that provider page. It has the form
   `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.

Do not use the Vercel `/auth/callback` URL as Google Cloud's redirect URI.
Google returns to Supabase first; Supabase then returns to Task AI.

## Google Cloud OAuth client

Use a **Web application** OAuth 2.0 client. Configure:

- Authorized JavaScript origin: `https://task-ai-navy.vercel.app`
- Authorized redirect URI:
  `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

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

## Git merge and production deployment

The historical `feature/task-ai-ux-safety-redesign` branch has already been
merged and is behind `main`; merging it again will not deploy newer code. For
the current auth fix, use a pull request from `fix/frontend-production-auth`
into `main`, or equivalently run:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git merge --no-ff origin/fix/frontend-production-auth
git push origin main
```

Pushing the merge to `main` triggers the configured Vercel production build.
Verify `/auth/callback` directly, then test Google success, Google denial,
email/password login, logout, and password recovery on the production origin.
