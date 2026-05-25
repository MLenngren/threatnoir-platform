## Local Development

This project supports running Supabase locally with migrations + seed data so you can iterate on UI changes without touching production.

### Prerequisites

- Docker (required by `supabase start`)
- Node.js + npm

### Quick start

1. Start local Supabase:
   - `npx supabase start`
2. Copy env:
   - `cp .env.local.example .env.local`
3. (Optional) Reset DB (applies migrations + `supabase/seed.sql`):
   - `npx supabase db reset`
4. Start dev server:
   - `npm run dev`
5. Open:
   - http://localhost:3000

### Useful commands

- Reset database (migrations + seed): `npx supabase db reset`
- Stop Supabase: `npx supabase stop`
- Check local URLs/keys: `npx supabase status`

### Notes

- Seed data is applied from `supabase/seed.sql` (see `supabase/config.toml` → `[db.seed]`).
- `npm run dev` is configured to load `.env.local` (see `package.json`).
- If `supabase start` fails, verify Docker is running and available to your shell.
