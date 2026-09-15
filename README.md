# Hair by Maeva

Mobile-first booking website for Hair by Maeva, built from the supplied Figma design and BLOWREPH font.

## Local setup

1. Copy `.env.example` to `.env` and fill the server-only Supabase service-role key, Resend API key/from address, admin email, and public URL.
2. Serve the folder with a static/serverless-capable host. The frontend is static; `/api/*.js` are Vercel functions.

## Connected services

- GitHub: `iangelot/hair-by-maeva-2` (main branch)
- Supabase: new project `hair-by-maeva-2`, ref `ebljbhjtnazslbdkpmbu`, `eu-west-1`
- Schema and seed catalog: `supabase/schema.sql`
- Resend: wire the verified sender and API key through Vercel environment variables; no secret is committed.
- Vercel: deploy the repository and add the variables from `.env.example` to Preview and Production.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` in browser code.
