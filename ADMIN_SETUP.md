# Hair by Maeva Admin setup

## Create the first administrator

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the business Auth user and enable **Auto Confirm User**.
3. Copy that user’s UUID.
4. In **SQL Editor**, run:

```sql
insert into public.admin_users (user_id)
values ('PASTE_AUTH_USER_UUID_HERE')
on conflict (user_id) do nothing;
```

5. Open `/admin.html` on the deployed site and sign in with that Auth user.

The browser only receives the Supabase publishable key. Service-role credentials are used only by Vercel serverless functions and must never be placed in `admin.html` or other public files.

## Required Vercel environment variables

Configure these for the project’s Production environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL`
- `ADMIN_EMAIL`
- `ADMIN_ROUTING_EMAIL` (optional)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional booking rules can be set through Admin under **Availability**; environment fallbacks are `BOOKING_MIN_NOTICE_HOURS` and `BOOKING_MAX_ADVANCE_DAYS`.
