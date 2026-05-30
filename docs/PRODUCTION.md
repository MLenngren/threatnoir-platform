## Production notes (operator skeleton)

This document is a lightweight starting point for deploying ThreatNoir in production.
It intentionally avoids provider-specific instructions — use your preferred stack and harden to your org’s standards.

### Reverse proxy

Run the app behind a reverse proxy (Caddy, nginx, Traefik) and forward your public domain to the app’s HTTP port (`APP_PORT`, default `7000`).
Keep the Supabase internal network endpoints private unless you have a specific reason to expose them.

**Caddy (minimal example):**

- Terminate TLS automatically with Let’s Encrypt.
- Proxy only the app’s HTTP traffic.

### TLS / SSL

Use Let’s Encrypt (via Caddy) or a managed certificate (via your hosting provider).
Ensure HTTP → HTTPS redirects are enabled.

### Backups

At a minimum, back up the Postgres data volume:

- **Logical:** scheduled `pg_dump` (daily/weekly) with encryption and off-host storage.
- **Physical:** volume snapshots (provider-specific) on a recurring schedule.

Test restores periodically; a backup you haven’t restored is a liability.

### Secrets and configuration

Store secrets outside the repository:

- Use your platform’s secret manager (recommended) or environment variable injection.
- Rotate `CRON_SECRET`, `AI_GATEWAY_INTERNAL_TOKEN`, and database credentials if leaked.

### Monitoring and auditability

ThreatNoir logs AI calls and cost metadata to the `ai_call_log` table.
For operational visibility:

- Monitor error logs for the app and ai-gateway containers.
- Use Supabase Studio for DB inspection (in production, prefer VPN / private access).

### Deployment modes

ThreatNoir supports two common patterns:

- **Self-hosted (Docker Compose):** app + self-hosted Supabase + ai-gateway.
- **Hybrid:** app on a platform (e.g. Vercel) + hosted Supabase (recommended for low-ops).

Choose based on your compliance and operational constraints.
