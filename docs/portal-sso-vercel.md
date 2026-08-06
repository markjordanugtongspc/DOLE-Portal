# Portal cookie sessions and SSO deployment

## Required Vercel environment variables

Configure the server-only variables in `src/backend/config/.env.example` in Vercel Project Settings for Development, Preview, and Production. Do not add the service-role key or either client secret to `VITE_*` variables.

## Database migration

Run `supabase/migrations/20260806130000_portal_cookie_sessions_and_sso.sql` in the Portal Supabase SQL Editor before deployment.

## Target callback contract

The Portal redirects a signed-in Portal user to the configured callback with `code` and `state` query parameters. The target browser must immediately send both values to its own backend. The target backend then calls the Portal:

```http
POST https://YOUR-PORTAL-DOMAIN/api/sso/consume
Content-Type: application/json
X-SSO-Client-Secret: target-server-only-secret

{"system_key":"SPES","code":"...","state":"..."}
```

A successful response identifies the target-local account to sign in as. The target must create its own authenticated session for `external_user_id`; it must never send its client secret to the browser.

## Local testing

`npm run dev` starts Vercel Dev and serves both the Vite application and `/api/*` Vercel routes locally. `npm run dev:vite` is frontend-only and will return 404 for `/api/*`. Set the same server-only values in the root `.env.local` file before starting Vercel Dev, or deploy a Vercel Preview and test there.