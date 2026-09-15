-- Keep appointment overlap protection in the database as well as the API.
-- The advisory lock serializes booking writes for the same calendar date.
create or replace function public.prevent_booking_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.appointment_date::text, 0));

  if exists (
    select 1
    from public.bookings b
    where b.id is distinct from new.id
      and b.appointment_date = new.appointment_date
      and b.status <> 'cancelled'
      and (new.appointment_date + new.appointment_time,
           new.appointment_date + new.appointment_time + make_interval(mins => new.duration_minutes))
          overlaps
          (b.appointment_date + b.appointment_time,
           b.appointment_date + b.appointment_time + make_interval(mins => b.duration_minutes))
  ) then
    raise exception 'That appointment overlaps an existing booking.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_booking_overlap() from public, anon, authenticated, service_role;

drop trigger if exists bookings_prevent_overlap on public.bookings;
create trigger bookings_prevent_overlap
before insert or update of appointment_date, appointment_time, duration_minutes, status
on public.bookings
for each row execute function public.prevent_booking_overlap();
