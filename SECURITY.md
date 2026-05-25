# Security Policy

## Supported versions

Only the latest commit on `main` is actively supported. Pin to a specific commit in production if stability matters.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report privately via one of:

- **Email:** security@threatnoir.com
- **GitHub Security Advisory:** [Report a vulnerability](https://github.com/MLenngren/threatnoir-platform/security/advisories/new) (preferred — gives both sides a private discussion thread)

Include:

- Description of the issue and potential impact
- Steps to reproduce (PoC welcome but not required)
- ThreatNoir commit hash affected
- Your contact info for follow-up

## What to expect

- **Acknowledgement:** within 72 hours
- **Assessment + plan:** within 7 days
- **Fix landed in `main`:** target 30 days for high/critical, longer for lower-severity issues
- **Public advisory:** published after the fix lands. Reporters credited unless they prefer to remain anonymous.

## Scope

In scope:
- The ThreatNoir codebase (this repo)
- Public-facing endpoints if you're testing against your own deployment

Out of scope:
- The production threatnoir.com deployment unless explicitly invited
- Denial-of-service attacks
- Issues in third-party services we depend on (Supabase, Vercel, Anthropic, etc.) — report directly to them

## Safe harbour

We will not pursue legal action against researchers who:
- Make a good-faith effort to follow this disclosure process
- Avoid privacy violations, data destruction, and service degradation
- Only test against deployments they own or have permission to test
