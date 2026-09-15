# Hair by Maeva

Mobile-first booking website for Hair by Maeva, built from the supplied Figma design and BLOWREPH font.

## Local setup

1. Copy `.env.example` to `.env` and fill the server-only Supabase service-role key, Resend API key/from address, admin email, and public URL.
2. Serve the folder with a static/serverless-capable host. The frontend is static; `/api/*.js` are Vercel functions.

## Connected services

- GitHub: `iangelot/hair-by-maeva-2` (main branch)
- Supabase: new project `hair-by-maeva-2`, ref `ebljbhjtnazslbdkpmbu`, `eu-west-1`
- Schema and seed catalog: `supabase/schema.sql`
- Resend: customer/admin notifications are addressed to `maevausa@outlook.com` and also `hairbymaevasystem@gmail.com` for Gmail routing. Set up Gmail forwarding from the routing inbox to Outlook if desired. A verified sender domain and API key are still required; no secret is committed.
- Vercel: deploy the repository and add the variables from `.env.example` to Preview and Production.

## Admin setup

Create Maeva's email/password user in Supabase Authentication, copy that user's UUID, replace the placeholder in `supabase/admin_setup.sql`, and run it once. Then open `/admin.html` and sign in. The admin surface is protected by Supabase Auth and the `admin_users` RLS gate.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` in browser code.
