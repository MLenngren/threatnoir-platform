# ThreatNoir

**Curated cybersecurity news. AI-enriched. Self-hostable.**

ThreatNoir ingests RSS feeds from major security publications, uses Claude to summarize, classify, score relevance, and extract IOCs (CVEs, domains, hashes, etc.), then publishes the result through a fast public site, a JSON API, a weekly email digest, daily podcast audio, and auto-generated awareness lessons. The reference deployment runs at [threatnoir.com](https://threatnoir.com).

This is the open-source release under Apache 2.0. Deploy your own instance and customize it — or contribute back.

---

## Features

**Ingest & enrichment**
- RSS pulls from 6+ default sources (BleepingComputer, The Hacker News, Krebs on Security, CISA Alerts, SecurityWeek, Dark Reading) — add or remove via the admin UI
- Article deduplication by URL
- AI summary, classification into 30+ categories, IOC extraction, relevance score (1–10), entity tagging — all in a single Claude API call per article
- Auto-approve high-relevance articles; auto-reject low-relevance ones; everything in between goes to a moderation queue
- Optional full-text scrape for richer summaries

**Distribution**
- Public site: feed, daily brief, weekly roundup, focus items, awareness lessons, podcast pages
- Weekly email digest with subscriber preferences (per-channel opt-in)
- Daily podcast (audio) with multi-host TTS (ElevenLabs)
- Daily video briefings (optional, requires HeyGen or similar)
- Auto-generated LinkedIn / X / Mastodon drafts in the admin UI for human review before posting

**Awareness & learning**
- Auto-generated security awareness lessons from approved articles (root cause analysis + prevention steps)
- Tips submission flow (community-contributed)
- Audience-specific landing pages (SOC, learners, leaders, developers)

**Public REST API**
- `GET /api/v1/iocs` — searchable IOC feed (CVE, IP, domain, hash, MITRE TTP, etc.)
- `GET /api/v1/articles` — article listing
- `GET /api/v1/focus` — high-impact alerts
- `GET /api/v1/weekly` — weekly roundups
- `GET /api/v1/awareness` — awareness lessons
- `POST /api/v1/submit` — community submissions
- Optional API key auth + per-key rate limiting

**Admin**
- Article approval/edit/bulk operations
- Category, source, subscriber, user, RBAC management
- AI cost dashboard (per-pipeline Anthropic spend breakdown, cache-hit rate, etc.)
- Audit log of all admin actions

**Operational**
- Per-call AI cost tracking (`ai_call_log` table) — never get surprised by a bill
- Configurable daily call cap and monthly budget cap
- Optional internal **AI gateway** (Docker Compose) so the app can run AI calls without embedding provider keys in the app container
- One-shot **bootstrap container** (Docker Compose) that seeds an admin user + backfills recent articles on first run
- Auto-publish to YouTube (optional, for video briefings)
- Discord ops alerts (optional)

---

## Quick start (Docker, ~10 minutes)

Run the full platform locally via Docker Compose: app (Nuxt SSR + API), self-hosted Supabase (Postgres + Auth + Storage), an internal AI gateway, local email (Inbucket), and a one-shot bootstrap container that seeds an admin user + backfills recent articles.

### Prerequisites

- Docker + Docker Compose v2
- (Optional) `openssl` to generate secrets

### Steps

1. Clone the repo:

   ```bash
   git clone https://github.com/MLenngren/threatnoir-platform
   cd threatnoir-platform
   ```

2. Copy the compose env file:

   ```bash
   cd deploy
   cp .env.example .env
   ```

3. Edit `deploy/.env` and set the bare minimum:

   - `AI_GATEWAY_INTERNAL_TOKEN` (required; the gateway refuses to start if blank)
     - generate: `openssl rand -hex 32`
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (required; used by the bootstrap container to seed your first admin)
   - Optional (enables AI during first bootstrap run; costs money):
     - `ANTHROPIC_API_KEY`
     - `BOOTSTRAP_RUN_AI=true`

4. Start the stack:

   ```bash
   docker compose up -d
   ```

5. Watch the one-shot bootstrap container until it prints `[bootstrap] Done`:

   ```bash
   docker compose logs -f bootstrap
   ```

6. Open:

   - App: http://localhost:7000
   - Supabase Studio: http://localhost:7101
   - Inbucket (catches password-reset / magic-link emails): http://localhost:7111

7. Log in to admin:

   - Go to http://localhost:7000/auth/login
   - Enter `ADMIN_EMAIL` + `ADMIN_PASSWORD` (the bootstrap container auto-confirmed
     the email, so no inbox click is needed)
   - You should land in `/admin`. If you forget the password, use `/auth/forgot-password`
     and the reset link will arrive in Inbucket at http://localhost:7111.

### What runs (URL map)

- `http://localhost:7000` → ThreatNoir app (Nuxt SSR + API)
- `http://localhost:7100` → Supabase API gateway (Kong)
- `http://localhost:7101` → Supabase Studio
- `http://localhost:7111` → Inbucket (local email inbox)
- `ai-gateway` runs **internal-only** (no host port)

### Next steps

- Deep dive on the compose stack: [`docs/CONTAINERS.md`](docs/CONTAINERS.md)
- Operator branding env vars: [`docs/OPERATOR-BRANDING.md`](docs/OPERATOR-BRANDING.md)
- AI gateway endpoints + pipeline labels: [`docs/AI-GATEWAY.md`](docs/AI-GATEWAY.md)
- Non-container local dev (Supabase CLI + `npm run dev`): [`docs/local-dev.md`](docs/local-dev.md)

---

## Architecture

ThreatNoir supports two common deployment modes:

- **Docker Compose (self-hosted):** app + self-hosted Supabase + internal `ai-gateway` + Inbucket + one-shot `bootstrap`
- **Vercel + Supabase (hosted):** app deployed to Vercel, backed by a hosted Supabase project

Core components:

- **Frontend + API:** [Nuxt 4](https://nuxt.com) (Vue 3, SSR)
- **Database + auth:** [Supabase](https://supabase.com) (Postgres + Row-Level Security)
- **AI:** [Anthropic Claude](https://anthropic.com)
- **Email:** [Resend](https://resend.com) (production) / Inbucket (local compose)

Docker Compose adds two operator-focused containers:

- **`ai-gateway`**: internal service that wraps AI calls and logs each call to `ai_call_log` with a `pipeline` label
- **`bootstrap`**: one-shot init that (optionally) seeds an admin user and backfills recent articles on first run

---

## Deploy to Vercel

The Docker Compose AI gateway is optional in production. If you are deploying the app to Vercel, leave `AI_GATEWAY_URL` empty/unset and the server will call Anthropic directly.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard)
2. Apply migrations: from your local clone, set the project ref and push:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. Note `SUPABASE_URL`, anon key, and service-role key from project settings → API

### 2. Vercel project

1. Push this repo to your own GitHub
2. Import to Vercel
3. Set env vars (see table below)
4. Add custom domain (optional)
5. Push to `main` → auto-deploy

### 3. Required env vars (minimum to boot)

| Var | Value |
| -- | -- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `NUXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) (transactional email) |
| `ADMIN_EMAIL` | Where admin notifications go |

### 4. AI pipeline env vars (enable summarize/awareness/roundup)

| Var | Value |
| -- | -- |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `AI_DAILY_LIMIT` | `500` (max calls per day; safety cap) |
| `AI_MONTHLY_BUDGET_CENTS` | `40000` ($400/month cap; tune to your budget) |
| `AI_AUTO_APPROVE_THRESHOLD` | `8` (score ≥ this → auto-publish) |
| `AI_AUTO_REJECT_THRESHOLD` | `3` (score ≤ this → auto-reject) |

### 5. Optional integrations

See `.env.example` for the full matrix. Each subsystem can be enabled independently:
- **Image generation** (weekly digest cover art): `OPENROUTER_API_KEY` + `R2_*`
- **Podcast pipeline**: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ALEX`, `ELEVENLABS_VOICE_MARCUS`, `WONDERCRAFT_API_KEY`
- **YouTube upload**: `YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`
- **Social posting**: `X_*` (Twitter), `MASTODON_*` (Mastodon)
- **Ops alerts**: `DISCORD_BOT_TOKEN`, `DISCORD_ALERTS_CHANNEL_ID`

---

## Cron schedule

The Vercel Hobby plan supports one daily cron. The included `vercel.json` schedules `/api/cron/ingest` at 06:00 UTC. The ingest cron chains the downstream pipeline internally:

```
ingest (06:00 UTC) → summarize → awareness lessons → social drafts → focus refresh
```

For higher-frequency runs (e.g. ingest every 4 hours) you'll need Vercel Pro, or you can trigger the cron endpoints externally with your own scheduler. Each cron endpoint accepts the `x-cron-secret` header.

The weekly roundup and weekly digest email cron at `/api/cron/generate-weekly-roundup` and `/api/cron/weekly-digest` are typically scheduled for Sunday — you'll need an external scheduler for these on Hobby.

---

## Configuration

- Operator branding (site name, logo, social links): [`docs/OPERATOR-BRANDING.md`](docs/OPERATOR-BRANDING.md)
- AI gateway deep dive (endpoints, pipeline labels, cost logs): [`docs/AI-GATEWAY.md`](docs/AI-GATEWAY.md)
- Docker Compose deep dive (ports, bootstrap, Inbucket vs Resend): [`docs/CONTAINERS.md`](docs/CONTAINERS.md)

### Hardcoded URLs

The codebase currently uses `threatnoir.com` as the canonical domain in SEO meta tags (canonical URLs, OG images, Twitter card URLs). If you deploy this under your own domain and care about SEO, search/replace `threatnoir.com` across `app/pages/` with your domain. The site itself runs fine without this change — only social previews and search-engine canonicalization are affected.

### RSS sources

Add or remove sources via the admin UI at `/admin/sources`, or directly in the Supabase `sources` table (`type: 'rss'`, `is_active: true`).

### Categories

Edit the `categories` table directly or via `/admin/categories`. The 30+ default categories cover most cybersecurity beats; trim or expand as you see fit.

### Branding

`nuxt.config.ts` controls site title and meta description. Replace `public/icon-*.png` for the favicon. Tailwind classes for the brand color (`tn-primary`, etc.) live in `app/assets/css/main.css`.

---

## Roadmap

- Phase 4 (DONE): pluggable AI providers — **Ollama** local model support
- Phase 4c (upcoming): OpenRouter provider
- Phase 4d (upcoming): local CLI provider
- Phase 5: compose profiles, healthchecks, polished operator UX

---

## Backups

We removed the operator-specific backup scripts before open-sourcing. Recommended approach for production:

- **Database:** Supabase Pro tier includes daily PITR backups. For Free tier, run `pg_dump` weekly via your own scheduled job and encrypt with `gpg` + a passphrase from your secret manager.
- **Vercel env vars:** export periodically with `npx vercel env pull` to a versioned + encrypted backup.
- **Media (R2/S3):** versioned bucket lifecycle rules + lifecycle-class storage are usually sufficient.

---

## Documentation

- `docs/local-dev.md` — local development setup
- `docs/CONTAINERS.md` — Docker Compose quick start + deep dive
- `docs/OPERATOR-BRANDING.md` — operator branding env vars
- `docs/AI-GATEWAY.md` — AI gateway endpoints + pipeline labels
- `.env.example` — every environment variable with purpose
- `CONTRIBUTING.md` — how to contribute
- `SECURITY.md` — vulnerability disclosure
- `CODE_OF_CONDUCT.md` — community standards

---

## API

- Public REST: `/api/v1/*` — see `/developer` on a running instance for the inline docs
- Admin: `/api/admin/*` — admin-auth gated
- Crons: `/api/cron/*` — `x-cron-secret` gated
- RSS feeds: `/api/feed.xml`, `/api/articles/feed.xml`, `/api/awareness/feed.xml`, `/api/focus/feed.xml`, `/api/podcast/feed.xml`, `/api/weekly/feed.xml`

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

In short: you can use, modify, redistribute, and commercialize this code. You must preserve the license and notice files, and (if you modify the source) note your changes.

---

## Contributing

We welcome PRs. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first and check [SECURITY.md](SECURITY.md) before disclosing security issues.

If you deploy a production instance, we'd love to hear about it — open an issue tagged `showcase`.
