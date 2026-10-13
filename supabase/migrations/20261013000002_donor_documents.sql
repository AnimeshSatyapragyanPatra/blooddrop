-- Proof of blood group.
--
-- Until now a donor's blood group was whatever they typed. That is the single
-- most load-bearing field in the app: a wrong group means a donor is alerted
-- for a patient they cannot help, travels, and is turned away at the bank —
-- or worse, is trusted when they should not be. This lets a donor upload
-- documentary proof and have a reviewer confirm it.
--
-- Deliberately minimal on retention: the row keeps the decision, not the
-- document. Files are deleted once reviewed (see storage.js), because holding
-- scans of identity documents is a liability that grows with every upload and
-- buys nothing after the review is done.

create table if not exists public.donor_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_type text not null check (doc_type in ('donor_card', 'lab_report', 'hospital_letter', 'govt_id')),
  -- What the donor says the document proves; the reviewer confirms or rejects.
  claimed_blood_group text not null
    check (claimed_blood_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  -- Where the file sits while it is awaiting review. Null once purged.
  file_path text,
  mime_type text,
  byte_size integer,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists donor_documents_status_idx
  on public.donor_documents (status, created_at desc);
create index if not exists donor_documents_user_idx
  on public.donor_documents (user_id, created_at desc);

-- The outcome lives on the donor, so matching and the UI can read it cheaply.
alter table public.donors
  add column if not exists blood_group_verified boolean not null default false;
alter table public.donors
  add column if not exists blood_group_verified_at timestamptz;

alter table public.donor_documents enable row level security;

-- A donor may see their own submissions and their status, but the file itself
-- is served only through the API to a reviewer.
drop policy if exists "own documents" on public.donor_documents;
create policy "own documents" on public.donor_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- match_donors must carry the new flag, so a requester can see at a glance
-- whether a matched donor's group was checked against a document.
create or replace function public.match_donors(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_groups text[]
)
returns table (
  user_id uuid, name text, email text, phone text, blood_group text,
  blood_group_verified boolean, area_label text,
  lat double precision, lng double precision, last_donation_date date,
  contact_pref text, paused boolean,
  alerts_received integer, responses_given integer,
  donations_confirmed integer, no_shows integer, distance_km double precision
)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    d.user_id, p.name, p.email, p.phone, d.blood_group,
    d.blood_group_verified, d.area_label,
    d.lat, d.lng, d.last_donation_date, d.contact_pref, d.paused,
    d.alerts_received, d.responses_given, d.donations_confirmed, d.no_shows,
    round((st_distance(d.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 2)::double precision
      as distance_km
  from public.donors d
  join public.profiles p on p.user_id = d.user_id
  where (p_groups is null or d.blood_group = any (p_groups))
    and st_dwithin(d.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
  order by distance_km asc;
$$;

revoke execute on function public.match_donors(double precision, double precision, double precision, text[]) from anon, authenticated;
