create table if not exists public.booking_settings (
  id integer primary key default 1 check (id = 1),
  minimum_notice_hours integer not null default 0 check (minimum_notice_hours >= 0),
  maximum_advance_days integer not null default 365 check (maximum_advance_days >= 1),
  updated_at timestamptz not null default now()
);
insert into public.booking_settings (id) values (1) on conflict (id) do nothing;
alter table public.booking_settings enable row level security;
create policy "admins manage booking settings" on public.booking_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
