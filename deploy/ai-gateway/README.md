## ThreatNoir AI Gateway (compose internal)

This is the Phase 2a scaffold for pluggable AI.

### Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /summarize-article` → drop-in replacement for `server/utils/anthropic.ts` `classifyAndSummarize()`.

### Auth

All non-health endpoints require header:

- `x-gateway-token: <AI_GATEWAY_INTERNAL_TOKEN>`

The gateway refuses to start if `AI_GATEWAY_INTERNAL_TOKEN` is empty.

### Required env

- `AI_GATEWAY_INTERNAL_TOKEN`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
