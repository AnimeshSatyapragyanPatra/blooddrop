# BloodDrop

**Live:** https://blooddrop-sigma.vercel.app · **Repo:** https://github.com/AnimeshSatyapragyanPatra/blooddrop


A local blood & emergency donor alert network. Someone posts "O- needed at
Durgapur Mission Hospital, 2 units, tonight" — every compatible, eligible donor
within the radius is alerted in seconds, and the requester watches the answers
come in instead of staring at a WhatsApp forward that nobody replies to.

```
frontend/   React + Vite app (Leaflet + OpenStreetMap for the maps)
backend/    Express API — matching, dispatch, masking, moderation
api/        Vercel serverless entry — re-exports backend/src/app.js
supabase/   SQL migrations, including the PostGIS matching function
```

## Run it locally with no accounts at all

The app ships with an in-memory mock of Supabase (Auth + Postgres + the PostGIS
RPC), seeded with 15 donors and two live requests around Durgapur, so it runs
with zero setup.

```bash
npm run install:all
npm run dev
```

- App: http://localhost:5174 · API: http://localhost:5065
- Data persists to `backend/.data/db.json` (`npm run reset:data` to reseed)

Seeded accounts:

| Role                 | Email                       | Password       |
|----------------------|-----------------------------|----------------|
| Donor (O+)           | `donor@blooddrop.test`      | `Donor123!`    |
| Verified hospital    | `hospital@blooddrop.test`   | `Hospital123!` |
| Individual requester | `requester@blooddrop.test`  | `Requester123!`|
| Moderator            | `admin@blooddrop.test`      | `Admin123!`    |

A five-minute tour: sign in as the **hospital**, post an O- request, watch the
match preview count donors as you drag the radius. Sign in as the **donor**,
accept it, and the requester's number unlocks. Back as the hospital, confirm the
donation — the donor's 90-day clock resets and they drop out of matching.

```bash
npm run smoke --prefix backend
```
runs the whole flow above against the API (56 assertions) without a browser.

## What it does

**Matching.** A request for A+ alerts O-, O+, A- and A+ donors — red-cell
compatibility, not string equality ([`blood.js`](backend/src/lib/blood.js)).
Distance comes from the database: `ST_DWithin` against a GiST index in Supabase,
the same haversine sweep in the mock. Donors inside the 90-day donation gap, or
who have paused themselves, are filtered out before anyone is disturbed.

**Ranking.** Distance leads, reliability nudges — a donor 1 km away always beats
one 12 km away, but between two similar distances the one who actually turns up
is alerted first ([`matching.js`](backend/src/lib/matching.js)).

**Response tracking.** Every alert is a row. The requester sees alerted /
answered / available / awaiting, live, so silence is a number rather than a
mystery.

**Phone masking.** Numbers live on the server. A donor sees `+91 ••••• ••210`
until they accept; then, and only then, the two sides can unlock each other —
and the person whose number was shown is told who looked. There is also a relay:
message the other party through the inbox with no number changing hands at all
([`contactController.js`](backend/src/controllers/contactController.js)).

**Verified requesters.** Hospitals and blood banks submit a registration number;
a moderator checks it. The badge is a snapshot taken when the request is posted,
and cannot be self-assigned.

**Reliability score.** Response rate and confirmed-donation rate, both smoothed
with a prior so a brand-new donor starts neutral at 50 rather than at 0
([`reliability.js`](backend/src/lib/reliability.js)). Shown as a labelled bar,
never a bare grade.

**Reports.** One click on any request. Removing a flagged request notifies the
requester *and* every donor who responded, so nobody makes a wasted trip.

## Using a real Supabase project

The Supabase CLI ships with the repo (`npx supabase`). From a clean checkout:

```bash
npx supabase login                                    # opens your browser
npx supabase link --project-ref <your-project-ref>    # asks for the DB password
npx supabase db push                                  # applies the migration
```

`db push` runs [`supabase/migrations/20260909000001_init_schema.sql`](supabase/migrations/20260909000001_init_schema.sql),
which enables PostGIS and creates the tables, GiST indexes, the `match_donors`
function and the row-level-security policies. If you would rather not use the
CLI, paste that same file into the Supabase SQL editor and run it.

Then fill in the keys:

| File | Variable | Where it comes from |
|---|---|---|
| `backend/.env` | `SUPABASE_URL` | Project Settings → Data API |
| `backend/.env` | `SUPABASE_ANON_KEY` | API Keys → publishable (`sb_publishable_…`) |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | API Keys → **secret** (`sb_secret_…`) — server only, never in a `VITE_` variable |
| `frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | same URL and publishable key |

Remove `MOCK_DB` / `VITE_MOCK` once the keys are in, then check the wiring:

```bash
npm run verify:supabase --prefix backend
```

It checks the credentials, all eight tables, the PostGIS `match_donors` RPC, the
generated geography column, Auth admin access and whether a moderator exists —
printing the exact fix for anything that fails.

A real project starts empty. To load the same demo dataset the offline mode
uses (four demo accounts, 15 donors, two live requests, a dispatch trail):

```bash
npm run seed:supabase --prefix backend
```

It refuses to run if the project already has profiles, unless you pass
`--force`. The demo accounts have published passwords — delete them before any
real use. Finally, make yourself a moderator by editing the email in
[`supabase/promote_admin.sql`](supabase/promote_admin.sql) and running it.

Nothing in the app changes between modes: the controllers call
`supabase.rpc("match_donors", …)` either way.

## Project documents

Two PDFs live in [`docs/`](docs/) and are generated from the codebase, not written by hand:

| File | What it is |
|---|---|
| `BloodDrop-Project-Report.pdf` | The full write-up: problem, design decisions, architecture, schema, testing, limitations |
| `BloodDrop-Questions.pdf` | Likely questions and answers, split into frontend, backend and database |

Regenerate them after any change:

```bash
cd docs && python3 make_reports.py
```

Structural figures — table count, endpoints, screens, number of assertions — are read
from the source by [`docs/facts.py`](docs/facts.py), so the documents cannot quietly
drift out of date. Neither document contains any credentials. Screenshots live in
`docs/screenshots/`; replace them and re-run to refresh the figures.

## Deploying

See [DEPLOY.md](DEPLOY.md). The repo root is Vercel-ready as-is.

## Alert channels

Every alert lands in the in-app inbox, which needs no configuration and no
budget. Email and SMS are pluggable drivers in
[`notify.js`](backend/src/lib/notify.js); with no provider keys set they log to
the server console and are recorded as `logged`, so the dispatch trail is
visible in a demo without a paid account.

## Not built yet

The engagement and stretch tiers — donation certificates, milestone badges, camp
calendar, eligibility nudges, predictive shortage alerts, referral chains, blood
bank inventory sync, SMS/WhatsApp bridges. The seams are in place: `notify.js`
for the channels, `donors.donations_confirmed` for the milestones, and the
`requests` history for the shortage analysis.
