-- Collection charges.
--
-- A deliberate note on what this does and does not model, because the
-- distinction is a legal one rather than a design preference.
--
-- Indian law bars paying a donor for blood. The Supreme Court's 1996
-- Common Cause judgment ordered professional donation abolished, and the
-- Drugs and Cosmetics Rules define a professional donor as one who gives
-- blood "for valuable consideration, in cash or kind". No amount recorded
-- here is ever payable to a donor, and there is no column in which such an
-- amount could be put.
--
-- What does change hands, lawfully and already today, is the blood bank's
-- processing charge: the cost of collecting, testing, typing, storing and
-- issuing a unit. It is paid by the requester to the licensed facility.
-- BloodDrop's own fee is charged for the service of running the platform,
-- and is shown separately rather than folded into the facility's charge.

-- Money is stored in paise as an integer. Floating point is the wrong type
-- for currency, and rupees-as-decimal invites rounding drift across a join.
alter table public.facilities
  add column if not exists processing_fee_paise integer not null default 0
    check (processing_fee_paise >= 0 and processing_fee_paise <= 2000000);

comment on column public.facilities.processing_fee_paise is
  'Facility processing charge per unit, in paise. Paid by the requester to the facility. Never paid to a donor.';

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  -- One charge per booking; re-booking the same slot updates it rather than
  -- stacking a second charge on the same donation.
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete restrict,
  -- Who owes it. The donor never appears on this side of the transaction.
  payer_user_id uuid not null references auth.users (id) on delete cascade,

  units integer not null check (units between 1 and 20),

  -- Resolved at booking time and then frozen. Recomputing a historical charge
  -- from today's configuration would silently rewrite what someone was quoted.
  processing_fee_paise integer not null check (processing_fee_paise >= 0),
  platform_fee_paise integer not null check (platform_fee_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 2000),

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'waived', 'cancelled')),
  -- Why a charge was waived: hardship, a camp donation, an admin decision.
  waived_reason text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists charges_payer_idx on public.charges (payer_user_id, created_at desc);
create index if not exists charges_facility_idx on public.charges (facility_id, created_at desc);
create index if not exists charges_status_idx on public.charges (status, created_at desc);

alter table public.charges enable row level security;

-- A payer sees their own charges and nobody else's.
drop policy if exists "own charges" on public.charges;
create policy "own charges" on public.charges
  for select using (auth.uid() = payer_user_id);
