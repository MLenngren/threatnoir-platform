## Running ThreatNoir with Docker Compose (deploy/)

This repo includes a Docker Compose setup under `deploy/` that runs:

- the Nuxt app (SSR + API)
- a self-hosted Supabase stack (Postgres + Auth + Storage)
- an internal AI gateway service (optional path)
- Inbucket for local magic-link email testing

### Quick start

```bash
cd deploy
cp .env.example .env
docker compose up -d
```

Then open:

- App: `http://localhost:7000` (or `APP_PORT`)
- Supabase Studio: `http://localhost:7101` (or `SUPABASE_STUDIO_PORT`)
- Inbucket: `http://localhost:7111` (or `INBUCKET_PORT`)

### Notes

- Postgres is *not* exposed on a host port by default. Enable the dev profile if you need it.
- AI in compose can be routed through the internal gateway (see `deploy/README.md`).
- Do **not** commit `deploy/.env` (it is operator-specific).

### Manual cron triggers

The compose stack includes the same cron endpoints as the Vercel deployment; you can trigger them manually with `x-cron-secret` (see `deploy/README.md`).
