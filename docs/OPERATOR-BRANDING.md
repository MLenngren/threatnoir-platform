## Operator branding (NUXT_PUBLIC_* env vars)

ThreatNoir is designed to be operator-pluggable: you can rebrand the public site without changing code by setting `NUXT_PUBLIC_*` variables.

Where to set these:

- **Docker Compose:** `deploy/.env`
- **Vercel:** Project Settings > Environment Variables

### Variables

| Var | What it controls | Example |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_NAME` | Site name used across UI + SEO | `AcmeSec Threat Brief` |
| `NUXT_PUBLIC_SITE_TAGLINE` | Tagline/subtitle used across UI + SEO | `Curated security news for busy teams.` |
| `NUXT_PUBLIC_SITE_URL` | Canonical base URL used in meta tags, RSS, sitemaps | `https://threatbrief.acmesec.com` |
| `NUXT_PUBLIC_SITE_LOGO_URL` | Header logo image URL (optional) | `https://your-cdn.com/logo.svg` |
| `NUXT_PUBLIC_SITE_OG_IMAGE_URL` | Default OpenGraph image URL (optional) | `https://your-cdn.com/og.png` |
| `NUXT_PUBLIC_PODCAST_ARTWORK_URL` | Podcast artwork URL (optional) | `https://your-cdn.com/podcast.jpg` |
| `NUXT_PUBLIC_CONTACT_EMAIL` | Public contact email (UI `mailto:` links) | `security@acmesec.com` |
| `NUXT_PUBLIC_OPERATOR_LEGAL_NAME` | Footer/legal display name (optional) | `AcmeSec, Inc.` |
| `NUXT_PUBLIC_SOCIAL_X_URL` | Social profile link (optional) | `https://x.com/acmesec` |
| `NUXT_PUBLIC_SOCIAL_LINKEDIN_URL` | Social profile link (optional) | `https://www.linkedin.com/company/acmesec/` |
| `NUXT_PUBLIC_SOCIAL_GITHUB_URL` | Social profile link (optional) | `https://github.com/acmesec` |
| `NUXT_PUBLIC_SOCIAL_YOUTUBE_URL` | Social profile link (optional) | `https://www.youtube.com/@acmesec` |
| `NUXT_PUBLIC_SPONSOR_LABEL` | Optional small label/badge in UI (optional) | `Community Edition` |
| `NUXT_PUBLIC_CDN_BASE_URL` | Optional base for generated weekly cover image URLs | `https://cdn.your-domain.com` |

Self-hosted Supabase override (compose / custom Supabase):

| Var | What it controls |
| --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | Browser-side Supabase URL override |
| `NUXT_PUBLIC_SUPABASE_KEY` | Browser-side Supabase anon key override |

### Worked example: AcmeSec rebrands ThreatNoir

An operator running Docker Compose can add the following to `deploy/.env`:

```env
NUXT_PUBLIC_SITE_NAME=AcmeSec Threat Brief
NUXT_PUBLIC_SITE_TAGLINE=Curated security news for busy teams.
NUXT_PUBLIC_SITE_URL=https://threatbrief.acmesec.com
NUXT_PUBLIC_SITE_LOGO_URL=https://cdn.acmesec.com/brand/threatbrief-logo.svg
NUXT_PUBLIC_SITE_OG_IMAGE_URL=https://cdn.acmesec.com/brand/threatbrief-og.png
NUXT_PUBLIC_CONTACT_EMAIL=security@acmesec.com
NUXT_PUBLIC_OPERATOR_LEGAL_NAME=AcmeSec, Inc.
NUXT_PUBLIC_SOCIAL_LINKEDIN_URL=https://www.linkedin.com/company/acmesec/
NUXT_PUBLIC_SOCIAL_X_URL=https://x.com/acmesec
NUXT_PUBLIC_SPONSOR_LABEL=AcmeSec SOC Edition
```

### Notes

- Any URL-like values should be absolute (`https://...`).
- If you don't want to host images on a CDN, you can also replace static assets under `public/` (favicons, icons).
