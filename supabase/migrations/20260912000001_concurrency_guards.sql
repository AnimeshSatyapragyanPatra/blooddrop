-- Concurrency guards.
--
-- Three places read a value and then wrote it back, which is safe only while
-- exactly one request is in flight. Under real concurrency they lose updates:
-- two callers read the same counter, both add one, and one increment vanishes.
--
-- The fix is to let Postgres do the arithmetic inside a single statement, so
-- the read and the write are one atomic operation on a locked row.

-- Donor counters feed the reliability score, so a lost increment silently
-- skews a donor's rating. `p_field` is whitelisted rather than interpolated —
-- it arrives from the application and must never reach SQL as raw text.
create or replace function public.record_donor_event(
  p_user_id uuid,
  p_field text,
  p_delta integer default 1,
  p_reset_eligibility boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field not in ('alerts_received', 'responses_given', 'donations_confirmed', 'no_shows') then
    raise exception 'record_donor_event: unknown field %', p_field;
  end if;

  update public.donors
  set
    alerts_received     = alerts_received     + (case when p_field = 'alerts_received'     then p_delta else 0 end),
    responses_given     = responses_given     + (case when p_field = 'responses_given'     then p_delta else 0 end),
    donations_confirmed = donations_confirmed + (case when p_field = 'donations_confirmed' then p_delta else 0 end),
    no_shows            = no_shows            + (case when p_field = 'no_shows'            then p_delta else 0 end),
    -- A confirmed donation restarts the 90-day eligibility clock.
    last_donation_date  = case when p_reset_eligibility then current_date else last_donation_date end
  where user_id = p_user_id;
end;
$$;

-- Same reasoning as match_donors: only the backend's service-role key may call it.
revoke execute on function public.record_donor_event(uuid, text, integer, boolean) from anon, authenticated;
