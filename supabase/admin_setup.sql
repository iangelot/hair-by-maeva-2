-- Run this only after creating Maeva's admin user in Supabase Auth.
-- Replace the UUID with the id from Authentication > Users.
insert into public.admin_users (user_id, display_name)
values ('00000000-0000-0000-0000-000000000000', 'Maeva')
on conflict (user_id) do update set display_name = excluded.display_name;

-- The placeholder UUID above is intentionally invalid. Replace it before running.
