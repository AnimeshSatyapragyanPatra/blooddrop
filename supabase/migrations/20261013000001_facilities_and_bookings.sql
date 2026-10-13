-- Facilities as the regulated intermediary.
--
-- Blood cannot pass from a donor to a patient directly: it must be collected at
-- a licensed facility, screened, typed and cross-matched before it is issued.
-- The first schema modelled the hospital as free text on a request, which
-- implied a donor and a requester meeting on their own. This migration makes
-- the facility a real entity, gives donors a booked slot there, and moves
-- confirmation of a donation to the people who actually witness it.

create extension if not exists "postgis";

-- ---------------------------------------------------------------------------
-- Facilities
-- ---------------------------------------------------------------------------

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('hospital', 'blood_bank')),
  address text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog geography(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  phone text,
  -- Opening hours drive the bookable slots. Kept deliberately simple: one
  -- window per day, the same every day. A real deployment would need per-day
  -- hours and holidays.
  open_time time not null default '09:00',
  close_time time not null default '17:00',
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 120),
  -- How many donors the facility can take in one slot.
  slot_capacity integer not null default 2 check (slot_capacity between 1 and 50),
  -- Licence/registration number an admin checked, same idea as requester
  -- verification. Only verified facilities can be booked.
  licence_ref text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists facilities_geog_idx on public.facilities using gist (geog);
create index if not exists facilities_verified_idx on public.facilities (verified);

-- Staff belong to a facility and are the only people who may confirm that a
-- donation actually happened there.
alter table public.profiles
  add column if not exists facility_id uuid references public.facilities (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('donor', 'requester', 'admin', 'facility'));

-- A request now points at a facility. hospital_name is kept as a free-text
-- fallback so existing rows stay readable and so a requester can still post
-- when their hospital is not registered yet.
alter table public.requests
  add column if not exists facility_id uuid references public.facilities (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Appointments — the donor's booked slot at the facility
-- ---------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  -- One booking per accepted response.
  response_id uuid not null unique references public.responses (id) on delete cascade,
  donor_user_id uuid not null references auth.users (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'completed', 'no_show', 'cancelled')),
  -- Who closed it out, and when. Only facility staff (or an admin) may.
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_facility_idx
  on public.appointments (facility_id, scheduled_at);
create index if not exists appointments_donor_idx
  on public.appointments (donor_user_id, scheduled_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.facilities enable row level security;
alter table public.appointments enable row level security;

-- Any signed-in user may read verified facilities: donors need to see where to
-- go, requesters need to pick one.
drop policy if exists "read verified facilities" on public.facilities;
create policy "read verified facilities" on public.facilities
  for select using (auth.role() = 'authenticated' and verified = true);

drop policy if exists "own appointments" on public.appointments;
create policy "own appointments" on public.appointments
  for all using (auth.uid() = donor_user_id) with check (auth.uid() = donor_user_id);

drop policy if exists "facility staff read appointments" on public.appointments;
create policy "facility staff read appointments" on public.appointments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'facility'
        and p.facility_id = appointments.facility_id
    )
  );

drop policy if exists "requester reads appointments" on public.appointments;
create policy "requester reads appointments" on public.appointments
  for select using (
    exists (select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid())
  );
