# Deploying BloodDrop to Vercel

The repo root deploys as-is: `vercel.json` builds `frontend/` as the static
site and serves `backend/src/app.js` as a serverless function under `/api/*`.

## 1. Supabase

Create a project, then in the SQL editor run:

1. `supabase/migrations/20260909000001_init_schema.sql` — PostGIS, tables, indexes, the
   `match_donors` function and RLS policies.
2. `supabase/promote_admin.sql` — edit the email first, then run
   it to give yourself the moderator role.

Confirm PostGIS is on:

```sql
select postgis_version();
```

## 2. Vercel environment variables

In Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — **server only** |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | same anon key |
| `DONATION_GAP_DAYS` | `90` (optional) |
| `DISPATCH_BATCH` | `25` (optional) |

Do **not** set `MOCK_DB` or `VITE_MOCK` in production — the mock database is
in-memory and resets on every cold start.

`VITE_API_URL` is deliberately unset in production: the frontend calls
same-origin `/api/*`, which `vercel.json` rewrites to the function.

## 3. Deploy

```bash
vercel --prod
```

or connect the GitHub repo and let Vercel build on push. Nothing in the app
needs a build step beyond `npm run build --prefix frontend`, which `vercel.json`
already declares.

## 4. Optional alert providers

Without these, alerts land in the in-app inbox and email/SMS are logged to the
function's console:

| Variable | Effect |
|---|---|
| `RESEND_API_KEY` | wire up the email driver in `backend/src/lib/notify.js` |
| `SMS_API_KEY` | wire up the SMS driver (Fast2SMS / Twilio) |

## Checking the deployment

```bash
curl https://<your-app>.vercel.app/api/health
```

`{"ok":true,"mock":false}` means it is talking to the real Supabase project.
`"mock":true` means credentials are missing and it silently fell back to the
in-memory database — check the environment variables.
