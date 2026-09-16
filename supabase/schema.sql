-- Hair by Maeva booking platform schema.
-- Apply through Supabase SQL editor or a migration once the project is available.

create extension if not exists pgcrypto;

create type public.booking_status as enum ('pending_payment','payment_submitted','confirmed','completed','cancelled','rescheduled');
create type public.payment_status as enum ('unpaid','payment_submitted','payment_verified','payment_not_received');

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_email_lower_idx on public.customers (lower(email));

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  notes text,
  preparation_instructions text,
  duration_minutes integer not null default 180 check (duration_minutes > 0),
  image_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_lengths (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  unique(service_id, name)
);

create table if not exists public.service_options (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  is_active boolean not null default true,
  display_order integer not null default 0
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  email text,
  phone text,
  payment_url text,
  deep_link text,
  instructions text,
  qr_code_path text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  unique(weekday, start_time, end_time)
);
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text
);
create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  start_time time not null,
  end_time time not null,
  reason text
);
create table if not exists public.booking_settings (
  id integer primary key default 1 check (id = 1),
  minimum_notice_hours integer not null default 0 check (minimum_notice_hours >= 0),
  maximum_advance_days integer not null default 365 check (maximum_advance_days >= 1),
  updated_at timestamptz not null default now()
);
insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique default ('HM-' || lpad((floor(random()*90000)+10000)::text, 5, '0')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name_snapshot text not null,
  length_name_snapshot text not null,
  options_snapshot jsonb not null default '[]'::jsonb,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null,
  total_price numeric(10,2) not null check (total_price >= 0),
  reservation_fee numeric(10,2) not null default 20 check (reservation_fee >= 0),
  remaining_balance numeric(10,2) not null check (remaining_balance >= 0),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  payment_status public.payment_status not null default 'unpaid',
  status public.booking_status not null default 'pending_payment',
  customer_notes text,
  admin_notes text,
  access_token_hash text not null unique,
  access_token_ciphertext text,
  token_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index if not exists bookings_active_slot_idx on public.bookings(appointment_date, appointment_time) where status <> 'cancelled';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  method_id uuid references public.payment_methods(id) on delete set null,
  status public.payment_status not null default 'unpaid',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text,
  alt_text text not null default '',
  category text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.website_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null,
  section_key text not null,
  content jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  unique(page_slug, section_key)
);
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  title text not null,
  body text not null,
  is_visible boolean not null default true,
  display_order integer not null default 0
);
create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  is_active boolean not null default true,
  display_order integer not null default 0
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  topic text not null,
  message text not null,
  booking_number text,
  is_read boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  subject text not null,
  html_body text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.customers enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_lengths enable row level security;
alter table public.service_options enable row level security;
alter table public.payment_methods enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.blocked_times enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_settings enable row level security;
alter table public.payments enable row level security;
alter table public.gallery_items enable row level security;
alter table public.website_sections enable row level security;
alter table public.policies enable row level security;
alter table public.social_links enable row level security;
alter table public.contact_messages enable row level security;
alter table public.email_templates enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

create policy "public can read active catalog" on public.service_categories for select to anon, authenticated using (is_active);
create policy "public can read active services" on public.services for select to anon, authenticated using (is_active);
create policy "public can read active lengths" on public.service_lengths for select to anon, authenticated using (is_active);
create policy "public can read active options" on public.service_options for select to anon, authenticated using (is_active);
create policy "public can read active payment methods" on public.payment_methods for select to anon, authenticated using (is_active);
create policy "public can read availability" on public.availability_rules for select to anon, authenticated using (is_active);
create policy "public can read active gallery" on public.gallery_items for select to anon, authenticated using (is_active);
create policy "public can read visible sections" on public.website_sections for select to anon, authenticated using (is_visible);
create policy "public can read visible policies" on public.policies for select to anon, authenticated using (is_visible);
create policy "public can read active socials" on public.social_links for select to anon, authenticated using (is_active);

create policy "admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins manage categories" on public.service_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage services" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage lengths" on public.service_lengths for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage options" on public.service_options for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage payments config" on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage availability" on public.availability_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage booking settings" on public.booking_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blocked dates" on public.blocked_dates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blocked times" on public.blocked_times for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage gallery" on public.gallery_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage cms" on public.website_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage policies" on public.policies for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage socials" on public.social_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage templates" on public.email_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customers" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage bookings" on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage contacts" on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Anonymous booking writes should happen through a server-side endpoint that validates
-- availability, snapshots prices, hashes the access token, and uses the service key.
revoke all on public.bookings from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.contact_messages from anon, authenticated;

-- Database-level overlap protection for concurrent booking requests.
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
    select 1 from public.bookings b
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
on public.bookings for each row execute function public.prevent_booking_overlap();

-- Initial editable catalog used by the first customer-facing build.
insert into public.service_categories (name, slug, display_order) values
  ('Braids', 'braids', 1), ('Twists', 'twists', 2), ('Locs', 'locs', 3)
on conflict (slug) do update set name = excluded.name;
insert into public.services (category_id, name, slug, description, image_path, duration_minutes, display_order) values
  ((select id from public.service_categories where slug='twists'), 'Senegalese Twist', 'senegalese-twist', 'Detailed, long-lasting twists tailored to you.', 'assets/service-senegalese.png', 240, 1),
  ((select id from public.service_categories where slug='braids'), 'Boho Knotless', 'boho-knotless', 'Soft, lightweight knotless braids with a lived-in finish.', 'assets/gallery-1.png', 300, 2),
  ((select id from public.service_categories where slug='locs'), 'Soft Locs', 'soft-locs', 'Protective soft locs with a polished, natural finish.', 'assets/gallery-2.png', 300, 3)
on conflict (slug) do update set description = excluded.description, image_path = excluded.image_path;
insert into public.service_lengths (service_id, name, price, display_order) select s.id, x.name, x.price, x.display_order from public.services s cross join (values ('Bob',200,1),('Middle',230,2),('Waist',260,3),('Butt',300,4)) x(name,price,display_order) where s.slug='senegalese-twist' on conflict (service_id,name) do update set price=excluded.price;
insert into public.service_lengths (service_id, name, price, display_order) select s.id, x.name, x.price, x.display_order from public.services s cross join (values ('Bob',180,1),('Middle',210,2),('Waist',240,3)) x(name,price,display_order) where s.slug='boho-knotless' on conflict (service_id,name) do update set price=excluded.price;
insert into public.service_lengths (service_id, name, price, display_order) select s.id, x.name, x.price, x.display_order from public.services s cross join (values ('Bob',220,1),('Middle',250,2),('Waist',280,3)) x(name,price,display_order) where s.slug='soft-locs' on conflict (service_id,name) do update set price=excluded.price;
insert into public.payment_methods (name, is_active, display_order) values ('PayPal', false, 1), ('Zelle', false, 2), ('Cash App', false, 3) on conflict do nothing;
insert into public.availability_rules (weekday, start_time, end_time) values (0,'09:00','17:00'),(2,'09:00','17:00'),(3,'09:00','17:00'),(4,'09:00','17:00'),(5,'09:00','17:00'),(6,'09:00','17:00') on conflict do nothing;
insert into public.policies (policy_key, title, body, display_order) values
  ('deposit','DEPOSIT','$20 non-refundable deposit required to secure your appointment. Applied toward your total service balance.',1),
  ('payment','PAYMENT & VERIFICATION','We accept Cash App, Zelle, and PayPal. Your payment is manually verified before your appointment is confirmed.',2),
  ('cancellation','CANCELLATION & RESCHEDULING','Please notify Maeva at least 24–48 hours before your appointment. No-shows and late cancellations may forfeit the deposit.',3),
  ('late-arrival','LATE ARRIVAL','There is a 15-minute grace period. After 15 minutes, a $25 late fee may apply.',4),
  ('extra-guests','EXTRA GUESTS','Children are welcome. Any other guest must be approved in advance. Please contact Maeva if you plan to bring someone with you.',5),
  ('address','ADDRESS','Your appointment address will be provided after your deposit has been verified. Check your confirmation email for appointment details.',6),
  ('hours','HOURS','Appointments are available during the business hours configured by Maeva.',7),
  ('booking-confirmation','BOOKING CONFIRMATION','After submitting your deposit, you will receive an email confirming that your payment is being verified. Once payment is verified, you will receive your official appointment confirmation.',8)
on conflict (policy_key) do update set body=excluded.body;
insert into public.website_sections (page_slug, section_key, content, display_order) values
  ('home','hero','{"title":"PROTECTIVE STYLES, MADE BEAUTIFULLY.","description":"Chicago based braiding specialist creating detailed, long-lasting styles tailored to you.","primaryCta":"BOOK AN APPOINTMENT","secondaryCta":"VIEW SERVICES ↓"}'::jsonb,1),
  ('home','services','{"eyebrow":"SERVICES & PRICING","title":"Quality styles, best pricing."}'::jsonb,2),
  ('home','booking','{"eyebrow":"READY WHEN YOU ARE","title":"Your next style starts here."}'::jsonb,3)
 ,('home','seo','{"title":"Hair by Maeva — Protective styles, made beautifully.","description":"Chicago-based braiding specialist creating detailed, long-lasting protective styles.","image":"./assets/web/hero.jpg"}'::jsonb,4)
on conflict (page_slug,section_key) do nothing;
insert into public.email_templates (template_key, subject, html_body) values
  ('payment_submitted','Hair by Maeva — Payment Submitted','<p>Hi {{customer_name}},</p><p>Your payment is awaiting verification.</p>'),
  ('payment_confirmed','Hair by Maeva — Appointment Confirmed','<p>Your appointment is confirmed.</p>'),
  ('booking_confirmation','Hair by Maeva — Booking Received','<p>Your booking request was received.</p>'),
  ('cancellation','Hair by Maeva — Booking Cancelled','<p>Your booking has been cancelled.</p>'),
  ('rescheduling','Hair by Maeva — Booking Rescheduled','<p>Your booking was rescheduled.</p>'),
  ('new_booking_admin','New Hair by Maeva Booking','<p>A new booking was received.</p>'),
  ('contact_notification','New Hair by Maeva Contact Message','<p>A new contact message was received.</p>')
on conflict (template_key) do nothing;

-- Supabase Storage media bucket for hero, service, and gallery images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hair-media', 'hair-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif']::text[])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "public read Hair by Maeva media" on storage.objects;
create policy "public read Hair by Maeva media" on storage.objects for select to public using (bucket_id = 'hair-media');
drop policy if exists "admins upload Hair by Maeva media" on storage.objects;
create policy "admins upload Hair by Maeva media" on storage.objects for insert to authenticated with check (bucket_id = 'hair-media' and public.is_admin());
drop policy if exists "admins update Hair by Maeva media" on storage.objects;
create policy "admins update Hair by Maeva media" on storage.objects for update to authenticated using (bucket_id = 'hair-media' and public.is_admin()) with check (bucket_id = 'hair-media' and public.is_admin());
drop policy if exists "admins delete Hair by Maeva media" on storage.objects;
create policy "admins delete Hair by Maeva media" on storage.objects for delete to authenticated using (bucket_id = 'hair-media' and public.is_admin());
