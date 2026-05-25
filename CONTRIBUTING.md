# Contributing to ThreatNoir

Thanks for your interest in contributing. This project is licensed under Apache 2.0 — by submitting a contribution you agree to license it under the same terms.

## Quick start (local dev)

```bash
# Clone + install
git clone https://github.com/MLenngren/threatnoir-platform
cd threatnoir-platform
npm install

# Start local Supabase (requires Docker)
npx supabase start

# Copy env + start the dev server
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

For more detail see [`docs/local-dev.md`](docs/local-dev.md).

## How to contribute

### Reporting issues

Use the GitHub issue tracker. Include:

- ThreatNoir commit/version
- What you expected vs what happened
- Reproduction steps
- Relevant logs (redact any secrets)

### Submitting changes

1. Fork the repo and create a topic branch (e.g. `fix/typo-in-feed-page` or `feat/foo-bar`)
2. Make focused commits with clear messages
3. Run `npm run lint` and `npm run build` locally — both must pass
4. Open a Pull Request against `main` with a description of what changed and why
5. Reference any related issue in the PR body

### What we welcome

- Bug fixes
- Documentation improvements (README, docs/, code comments)
- New RSS source integrations
- Test coverage
- Performance improvements (especially around SSR caching and Supabase queries)
- New public API endpoints (must include docs)
- Accessibility improvements

### What to discuss first (open an issue before coding)

- Schema changes (Supabase migrations) — break upgrades for existing deployers
- Removing or renaming env vars — same reason
- Architectural changes to the cron pipeline
- New paid third-party integrations (please justify)
- UI/UX redesigns

## Code style

- TypeScript: follow the existing patterns. No `any` unless justified.
- Vue: composition API, `<script setup>` blocks.
- Python: PEP 8, type hints required on new functions.
- Server routes: validate input at the boundary, use `serverSupabaseServiceRole` for admin operations.
- Database access: prefer single round-trips, batch where possible.
- No new dependencies without strong justification — every new dep is something downstream deployers have to trust.

## Testing

Run `npm run lint` and `npm run build` before opening a PR. End-to-end tests are TBD — contributions to add a test framework are welcome.

## Security

If you find a security vulnerability, **do not open a public issue**. See [SECURITY.md](SECURITY.md) for disclosure process.

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). We use the Contributor Covenant 2.1.

## Questions?

- General questions: open a GitHub Discussion (when enabled) or an issue tagged `question`
- Security: see [SECURITY.md](SECURITY.md)
