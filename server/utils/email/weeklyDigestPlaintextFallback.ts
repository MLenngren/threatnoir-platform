import { DEFAULT_SITE_URL } from '../../../shared/siteDefaults'

type WeeklyDigestInput = {
  email: string
  siteUrl: string
  unsubscribeUrl: string
  weekLabel: string
  weeklySlug: string | null
  weeklyTldr: string | null
  executiveSummary?: string
  tagline?: string
  coverImageUrl?: string
  focusItems: Array<{ title: string; severity: string }>
  awarenessLesson: { title: string; slug: string } | null
  latestPodcast: { title: string; date: string } | null
  upcomingEvents: Array<{ title: string; date: string }>
}

function escapeHtml(input: string): string {
  return (input || '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return ch
    }
  })
}

function normalizeSiteUrl(raw?: string | null): string {
	const v = (raw || '').trim() || DEFAULT_SITE_URL
  return v.replace(/\/$/, '')
}

function safeHttpUrl(raw: string): string {
  const href = (raw || '').trim()
  if (!href) return ''
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.toString()
  } catch {
    return ''
  }
}

function linkifyAndEscape(text: string): string {
  const src = text || ''
  if (!src) return ''

  // Simple, email-safe URL linkifier for bare URLs.
  // Avoids regex backtracking pitfalls by using a straightforward global match.
  const urlRe = /https?:\/\/[^\s<]+/g

  let out = ''
  let last = 0
  for (let m = urlRe.exec(src); m; m = urlRe.exec(src)) {
    const start = m.index
    const raw = m[0]
    out += escapeHtml(src.slice(last, start))

    // Trim common trailing punctuation that often follows URLs in prose.
    const trimmed = raw.replace(/[)\]}.,;:!]+$/g, '')
    const trailing = raw.slice(trimmed.length)

    const safe = safeHttpUrl(trimmed)
    if (safe) {
      out += `<a href="${escapeHtml(safe)}" style="color:#4cd7f6;">${escapeHtml(trimmed)}</a>`
      // Append any trailing chars that were removed by trimming.
      out += escapeHtml(trailing)
    } else {
      out += escapeHtml(raw)
    }

    last = start + raw.length
  }
  out += escapeHtml(src.slice(last))
  return out
}

function preBlock(label: string, raw: string): string {
  const body = (raw || '').trim()
  const content = body ? linkifyAndEscape(body) : '<span style="color:#64748b;">(empty)</span>'

  return [
    `<div style="margin:16px 0 0;">`,
    `<div style="color:#ffffff; font-size:16px; font-weight:700; margin:0 0 8px;">${escapeHtml(label)}</div>`,
    `<pre style="margin:0; padding:12px; background:#0e131f; border:1px solid #1e293b; border-radius:10px; color:#94a3b8; line-height:1.6; white-space:pre-wrap; word-break:break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${content}</pre>`,
    `</div>`
  ].join('')
}

/**
 * Emergency fallback renderer for weekly digest emails.
 *
 * Requirements:
 * - No marked dependency
 * - Never throws
 * - Email-safe, uses inline styles
 */
export function renderWeeklyDigestPlaintextFallback(
  data: Partial<WeeklyDigestInput>
): { subject: string; html: string; text: string } {
  try {
    const site = normalizeSiteUrl(data.siteUrl)
    const weekLabel = (data.weekLabel || '').trim() || 'Unknown week'
    const subject = `Your week in security — ${weekLabel}`

    const weeklyUrl = data.weeklySlug ? `${site}/weekly/${data.weeklySlug}` : `${site}/weekly`
    const tagline = (data.tagline || '').trim()

    const weeklyTldr = typeof data.weeklyTldr === 'string' ? data.weeklyTldr : ''
    const executiveSummary = (data.executiveSummary || '').trim()

    const html = [
      `<!DOCTYPE html>`,
      `<html><body style="background:#0e131f; color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; padding:0;">`,
      `<div style="max-width:600px; margin:0 auto; padding:32px 24px;">`,
      `<div style="color:#4cd7f6; font-weight:900; letter-spacing:2px; text-transform:uppercase;">ThreatNoir</div>`,
      `<p style="color:#64748b; font-size:12px; margin:8px 0 0;">${escapeHtml(weekLabel)}</p>`,
      tagline
        ? `<p style="font-style:italic; font-size:18px; color:#4cd7f6; margin:16px 0 0;">${escapeHtml(tagline)}</p>`
        : '',
      preBlock('TL;DR', weeklyTldr),
      executiveSummary ? preBlock('Executive summary', executiveSummary) : '',
      `<div style="margin:16px 0 0;">`,
      `<a href="${escapeHtml(weeklyUrl)}" style="display:inline-block; background:#4cd7f6; color:#0e131f; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:700;">Read the roundup</a>`,
      `</div>`,
      `<div style="color:#64748b; font-size:12px; margin-top:32px; border-top:1px solid #1e293b; padding-top:16px;">`,
      `Manage preferences: <a href="${escapeHtml(site + '/subscribe')}" style="color:#4cd7f6;">${escapeHtml(site + '/subscribe')}</a><br>`,
      `Unsubscribe: <a href="${escapeHtml((data.unsubscribeUrl || '').trim() || site)}" style="color:#4cd7f6;">${escapeHtml((data.unsubscribeUrl || '').trim() || site)}</a>`,
      `</div>`,
      `</div></body></html>`
    ]
      .filter(Boolean)
      .join('')

    const text = [
      subject,
      tagline ? `Tagline: ${tagline}` : '',
      '',
      'TL;DR',
      (weeklyTldr || '').trim() || '(empty)',
      '',
      executiveSummary ? `Executive summary\n${executiveSummary}` : '',
      '',
      `Read the roundup: ${weeklyUrl}`,
      '',
      `Manage preferences: ${site}/subscribe`,
      `Unsubscribe: ${(data.unsubscribeUrl || '').trim() || site}`
    ]
      .map((line) => (typeof line === 'string' ? line : ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return { subject, html, text }
  } catch {
    // Ultimate defense: even our fallback renderer must never throw.
    const subject = 'ThreatNoir weekly digest'
    const html = '<html><body><pre>ThreatNoir weekly digest (render fallback failed)</pre></body></html>'
    const text = 'ThreatNoir weekly digest (render fallback failed)'
    return { subject, html, text }
  }
}
