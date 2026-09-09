-- BloodDrop schema — run in the Supabase SQL editor (or via the CLI).
-- Only needed for a real Supabase project; the app runs on the in-memory mock
-- database without any of this.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  role text not null default 'donor' check (role in ('donor', 'requester', 'admin')),
  organization text,
  org_type text check (org_type in ('hospital', 'blood_bank', 'ngo')),
  -- Set only by an admin reviewing a verifications row. Never self-serve.
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  blood_group text not null check (blood_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- Derived point, kept in sync automatically so geo queries never drift from
  -- the lat/lng the app writes.
  geog geography(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  area_label text,
  last_donation_date date,
  contact_pref text not null default 'inapp' check (contact_pref in ('inapp', 'email', 'sms')),
  paused boolean not null default false,
  alerts_received integer not null default 0,
  responses_given integer not null default 0,
  donations_confirmed integer not null default 0,
  no_shows integer not null default 0,
  created_at timestamptz not null default now()
);

-- The index the whole matching feature rests on.
create index if not exists donors_geog_idx on public.donors using gist (geog);
create index if not exists donors_blood_group_idx on public.donors (blood_group);

-- ---------------------------------------------------------------------------
-- Requests and the alert loop
-- ---------------------------------------------------------------------------

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  patient_name text,
  blood_group text not null check (blood_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  units_needed integer not null default 1 check (units_needed between 1 and 20),
  hospital_name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog geography(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  area_label text,
  urgency text not null check (urgency in ('critical', 'urgent', 'routine')),
  needed_by timestamptz,
  notes text,
  radius_km double precision not null default 15 check (radius_km > 0 and radius_km <= 100),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'closed', 'removed')),
  -- Snapshot of the requester's verified flag at posting time.
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists requests_geog_idx on public.requests using gist (geog);
create index if not exists requests_status_idx on public.requests (status, created_at desc);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  donor_user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'inapp',
  status text not null default 'sent',
  distance_km double precision,
  sent_at timestamptz not null default now(),
  unique (request_id, donor_user_id)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  donor_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('available', 'unavailable')),
  note text,
  outcome text check (outcome in ('donated', 'no_show')),
  responded_at timestamptz not null default now(),
  unique (request_id, donor_user_id)
);

create index if not exists responses_request_idx on public.responses (request_id);

-- ---------------------------------------------------------------------------
-- Trust & safety
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('request', 'user')),
  target_id uuid not null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('fake', 'suspicious', 'spam', 'no_show', 'harassment', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization text not null,
  org_type text not null check (org_type in ('hospital', 'blood_bank', 'ngo')),
  proof_ref text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  request_id uuid references public.requests (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Matching: the PostGIS query behind every search and every alert dispatch.
-- The JS mock in backend/src/lib/mockDb.js mirrors this exactly.
-- ---------------------------------------------------------------------------

create or replace function public.match_donors(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_groups text[]
)
returns table (
  user_id uuid,
  name text,
  email text,
  phone text,
  blood_group text,
  area_label text,
  lat double precision,
  lng double precision,
  last_donation_date date,
  contact_pref text,
  paused boolean,
  alerts_received integer,
  responses_given integer,
  donations_confirmed integer,
  no_shows integer,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    d.user_id,
    p.name,
    p.email,
    p.phone,
    d.blood_group,
    d.area_label,
    d.lat,
    d.lng,
    d.last_donation_date,
    d.contact_pref,
    d.paused,
    d.alerts_received,
    d.responses_given,
    d.donations_confirmed,
    d.no_shows,
    round((st_distance(d.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 2)::double precision
      as distance_km
  from public.donors d
  join public.profiles p on p.user_id = d.user_id
  where (p_groups is null or d.blood_group = any (p_groups))
    -- ST_DWithin is the index-using form; ST_Distance alone would seq-scan.
    and st_dwithin(d.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
  order by distance_km asc;
$$;

-- Only the backend's service-role key may call it; it returns contact details
-- that the masking layer is responsible for stripping.
revoke execute on function public.match_donors(double precision, double precision, double precision, text[]) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- The Express backend uses the service-role key and bypasses these. They are
-- the safety net for anything that ever talks to Postgres directly.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.donors enable row level security;
alter table public.requests enable row level security;
alter table public.alerts enable row level security;
alter table public.responses enable row level security;
alter table public.reports enable row level security;
alter table public.verifications enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own donor record" on public.donors;
create policy "own donor record" on public.donors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Open requests are readable by any signed-in user; only the owner may write.
drop policy if exists "read open requests" on public.requests;
create policy "read open requests" on public.requests
  for select using (auth.role() = 'authenticated' and (status = 'open' or requester_id = auth.uid()));

drop policy if exists "own requests" on public.requests;
create policy "own requests" on public.requests
  for all using (auth.uid() = requester_id) with check (auth.uid() = requester_id);

drop policy if exists "own alerts" on public.alerts;
create policy "own alerts" on public.alerts
  for select using (auth.uid() = donor_user_id);

drop policy if exists "own responses" on public.responses;
create policy "own responses" on public.responses
  for all using (auth.uid() = donor_user_id) with check (auth.uid() = donor_user_id);

drop policy if exists "requester reads responses" on public.responses;
create policy "requester reads responses" on public.responses
  for select using (
    exists (select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid())
  );

drop policy if exists "own reports" on public.reports;
create policy "own reports" on public.reports
  for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

drop policy if exists "own verifications" on public.verifications;
create policy "own verifications" on public.verifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Keep a profile row in step with auth.users, so a user created through the
-- Supabase dashboard is usable immediately.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    'donor'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
