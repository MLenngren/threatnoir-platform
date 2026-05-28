## ThreatNoir Platform — Local Docker Compose (Phase 1 Skeleton)

This directory lets you run the entire ThreatNoir platform locally with:

```bash
cd deploy
cp .env.example .env
docker compose up -d
```

### Services + Ports

- App (Nuxt SSR + API): `http://localhost:${APP_PORT:-7000}`
- Supabase API (Kong): `http://localhost:${SUPABASE_KONG_PORT:-7100}`
- Supabase Studio: `http://localhost:${SUPABASE_STUDIO_PORT:-7101}`
- Inbucket (magic-link emails): `http://localhost:${INBUCKET_PORT:-7111}`

Postgres direct is **off by default**. Enable via dev profile:

```bash
docker compose --profile dev up -d
```

Then connect to Postgres at `localhost:${SUPABASE_DB_PORT:-7110}`.

### Logging in (Magic Link)

1. Go to `http://localhost:${APP_PORT:-7000}/admin/login`
2. Enter your email and send magic link
3. Open Inbucket UI at `http://localhost:${INBUCKET_PORT:-7111}` and click the magic link
4. You should land in `/admin`

### Manual cron triggers

```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:${APP_PORT:-7000}/api/cron/ingest
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:${APP_PORT:-7000}/api/cron/summarize
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:${APP_PORT:-7000}/api/cron/generate-weekly-roundup
```

### How AI works in compose

In Docker Compose, the app does **not** call Anthropic directly. Instead:

`app` → `POST http://ai-gateway:8080/summarize-article` → Anthropic API → logs to `ai_call_log` in Supabase.

Controls:

- To disable AI globally: set `AI_ENABLED=false` in `deploy/.env` and restart.
- To disable the gateway and return to direct-Anthropic calls: stop the gateway **and** unset `AI_GATEWAY_URL` in the `app` environment.

Security:

- The gateway is internal-only (no host port mapping).
- Requests must include `x-gateway-token` matching `AI_GATEWAY_INTERNAL_TOKEN`.

### Stopping safely (does not affect trading containers)

This compose stack is isolated via `name: threatnoir-platform` and `COMPOSE_PROJECT_NAME=threatnoir-platform`.

To stop it without deleting volumes:

```bash
cd deploy
docker compose down
```

Do **not** use `-v` unless you intentionally want to delete the local Supabase data.
