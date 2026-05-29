import { DEFAULT_SITE_URL } from '../../shared/siteDefaults'

const MAX_STATUS_LEN = 500

const MASTODON_INSTANCE = (process.env.MASTODON_INSTANCE_URL || 'https://infosec.exchange').replace(/\/$/, '')

function truncateStatus(input: string, maxLen = MAX_STATUS_LEN): string {
  const s = String(input || '').trim()
  if (!s) return ''
  if (s.length <= maxLen) return s
  return `${s.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`
}

export async function postToMastodon(status: string): Promise<{ id: string; url: string } | null> {
  const token = (process.env.MASTODON_ACCESS_TOKEN || '').trim()
  if (!token) {
    console.warn('[mastodon] MASTODON_ACCESS_TOKEN not set, skipping post')
    return null
  }

  const payload = {
    status: truncateStatus(status),
    visibility: 'public'
  }

  const res = await fetch(`${MASTODON_INSTANCE}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 500)
    console.warn(`[mastodon] post failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`)
    return null
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const id = json && typeof json.id === 'string' ? json.id : ''
  const url = json && typeof json.url === 'string' ? json.url : (json && typeof json.uri === 'string' ? json.uri : '')

  if (!id) {
    console.warn('[mastodon] unexpected response (missing id)')
    return null
  }

  return { id, url: url || '' }
}

export function formatWeeklyPost(data: {
  weekLabel: string
  slug: string
  tldr: string
  siteUrl: string
}): string {
	  const base = (data.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '')
  const url = `${base}/weekly/${data.slug}`
  const tldr = truncateStatus(data.tldr || '', 300)

  return truncateStatus(
    `${data.weekLabel} — Weekly Threat Roundup\n\n${tldr}\n\n${url}\n\n#infosec #cybersecurity #threatintel`
  )
}

export function formatFocusPost(data: {
  title: string
  severity: string
  summary: string
  siteUrl: string
}): string {
	  const base = (data.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '')
  const severity = (data.severity || '').toUpperCase()
  const summary = truncateStatus(data.summary || '', 300)

  return truncateStatus(`⚠️ ${severity}: ${data.title}\n\n${summary}\n\n${base}/focus\n\n#infosec #cybersecurity`)
}

