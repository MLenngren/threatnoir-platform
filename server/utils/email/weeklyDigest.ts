import { marked } from 'marked'
import type { RendererThis, Tokens } from 'marked'
import { DEFAULT_SITE_URL } from '../../../shared/siteDefaults'

import { getSiteConfig } from '../siteConfig'

const BASE_STYLES = `
<style>
  body { background: #0e131f; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .logo { color: #4cd7f6; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  .card { background: #161c28; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin: 16px 0; }
  h1 { color: #ffffff; font-size: 24px; margin: 0 0 8px; }
  h2 { color: #ffffff; font-size: 18px; margin: 0 0 12px; }
  p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
  a { color: #4cd7f6; }
  ul { margin: 0 0 16px; padding-left: 18px; }
  li { color: #94a3b8; line-height: 1.6; margin: 0 0 8px; }
  .button { display: inline-block; background: #4cd7f6; color: #0e131f !important; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }
  .meta { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  .badge { display: inline-block; font-size: 12px; line-height: 18px; padding: 2px 8px; border-radius: 999px; border: 1px solid #1e293b; background: #0e131f; color: #94a3b8; margin-right: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .badge-critical { border-color: #7f1d1d; color: #fecaca; }
  .badge-high { border-color: #92400e; color: #fed7aa; }
  .badge-medium { border-color: #1e3a8a; color: #bfdbfe; }
  .footer { color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; }
</style>
`

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

function footerHtml(data: { siteUrl?: string | null; unsubscribeUrl: string }): string {
	const siteConfig = getSiteConfig()
	const siteName = escapeHtml(siteConfig.name)

  const site = normalizeSiteUrl(data.siteUrl)
  const manageUrl = `${site}/subscribe`
  const unsubUrl = (data.unsubscribeUrl || '').trim() || site

  return [
    `<div class="footer">`,
	  `You're receiving this because you signed up for ${siteName} at ${escapeHtml(site)}<br>`,
    `<a href="${escapeHtml(manageUrl)}">Manage preferences</a> · <a href="${escapeHtml(unsubUrl)}">Unsubscribe</a>`,
    `</div>`
  ].join('')
}

function severityClass(severityRaw: string): string {
  const s = (severityRaw || '').trim().toLowerCase()
  if (s === 'critical') return 'badge-critical'
  if (s === 'high') return 'badge-high'
  if (s === 'medium') return 'badge-medium'
  return ''
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

function safeEmailHref(raw: string): string {
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

function renderSafeMarkdown(src: string): string {
  // Pre-process: convert common Unicode bullets to markdown dashes so marked treats them as list items.
  // LLM outputs frequently use these instead of '-' even when prompted otherwise.
  const sanitized = (src || '').replace(
    /^[ \t]*[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF\u2024\u00B7][ \t]+/gm,
    '- '
  )

  const renderer = new marked.Renderer()

  // Defense-in-depth: ignore any raw HTML embedded in markdown.
  renderer.html = () => ''
  renderer.image = () => ''

  // Inline styles on every block + inline element so email clients can't strip them.
  renderer.paragraph = function (this: RendererThis, { tokens }: Tokens.Paragraph) {
    const inner = this.parser.parseInline(tokens)
    return `<p style="color:#94a3b8; line-height:1.6; margin:0 0 12px;">${inner}</p>`
  }

  type EmailRendererThis = RendererThis & {
    listitem: (item: Tokens.ListItem) => string
  }

  renderer.list = function (this: EmailRendererThis, { ordered, items }: Tokens.List) {
    const tag = ordered ? 'ol' : 'ul'
    const inner = items.map((it) => this.listitem(it)).join('')
    return `<${tag} style="color:#94a3b8; margin:0 0 12px; padding-left:20px;">${inner}</${tag}>`
  }

  renderer.listitem = function (this: EmailRendererThis, item: Tokens.ListItem) {
    const tokens = item.tokens || []
    const inner = tokens
      .map((token: { type: string; tokens?: unknown[] }) => {
        if (token.type === 'paragraph') {
          // Loose lists wrap content in paragraph blocks. Unwrap to inline for <li>.
          return this.parser.parseInline((token.tokens || []) as Tokens.Token[])
        }
        if (token.type === 'space') return ''
        // Nested lists, code blocks, etc — full block parse.
        return this.parser.parse([token as unknown as Tokens.Token])
      })
      .join('')
    return `<li style="color:#94a3b8; line-height:1.6; margin:0 0 6px;">${inner}</li>`
  }

  renderer.strong = function (this: RendererThis, { tokens }: Tokens.Strong) {
    const inner = this.parser.parseInline(tokens)
    return `<strong style="color:#ffffff; font-weight:bold;">${inner}</strong>`
  }

  renderer.em = function (this: RendererThis, { tokens }: Tokens.Em) {
    const inner = this.parser.parseInline(tokens)
    return `<em style="color:#94a3b8; font-style:italic;">${inner}</em>`
  }

  renderer.heading = function (this: RendererThis, { tokens, depth }: Tokens.Heading) {
    const inner = this.parser.parseInline(tokens)
    const size = depth === 1 ? '20px' : depth === 2 ? '17px' : '15px'
    return `<h${depth} style="color:#ffffff; font-size:${size}; margin:16px 0 8px;">${inner}</h${depth}>`
  }

  renderer.link = ({ href, title, text }: Tokens.Link) => {
    const safe = safeEmailHref(href || '')
    const t = title ? ` title="${escapeHtml(title)}"` : ''
    if (!safe) return text
    return `<a href="${escapeHtml(safe)}"${t} style="color:#4cd7f6;">${text}</a>`
  }

  return marked.parse(sanitized, {
    renderer,
    gfm: true,
    breaks: true,
    mangle: false,
    headerIds: false
  }) as string
}

export function renderWeeklyDigest(data: {
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
}): { subject: string; html: string; text: string } {
	const siteConfig = getSiteConfig()
  const site = normalizeSiteUrl(data.siteUrl)
  const subject = `Your week in security — ${data.weekLabel}`

  const weeklyUrl = data.weeklySlug ? `${site}/weekly/${data.weeklySlug}` : `${site}/weekly`
  const tldr = (data.weeklyTldr || '').trim()
  // Promote single newlines to paragraph breaks so each TL;DR highlight gets its own <p>
  // with the renderer's default bottom margin. Negative lookahead avoids doubling-up
  // where the source already has \n\n.
  const tldrForRender = tldr.replace(/\n(?!\n)/g, '\n\n')
  const tldrHtml = tldr
    ? `<p style="color:#94a3b8; line-height:1.6; margin:0 0 8px;"><strong style="color:#ffffff; font-weight:bold;">TL;DR</strong></p>${renderSafeMarkdown(tldrForRender)}`
    : ''

  const tagline = (data.tagline || '').trim()
  const taglineHtml = tagline
    ? `<p style="font-style:italic; font-size:18px; color:#4CD7F6; margin:16px 0;">${escapeHtml(tagline)}</p>`
    : ''

  const executiveSummary = (data.executiveSummary || '').trim()
  const executiveSummaryHtml = executiveSummary ? renderSafeMarkdown(executiveSummary) : ''
  const executiveSummaryCardHtml = executiveSummaryHtml
    ? `<div class="card"><h2>Executive summary</h2>${executiveSummaryHtml}</div>`
    : ''

  const coverImageUrl = (data.coverImageUrl || '').trim()
  const coverImgHtml = coverImageUrl
    ? `<img src="${escapeHtml(coverImageUrl)}" alt="" style="display:block; width:100%; max-height:400px; object-fit:cover; border-radius:12px 12px 0 0;" />`
    : ''

  const focus = (data.focusItems || []).slice(0, 3)
  const focusHtml = focus.length
    ? `<ul>${focus
        .map((i) => {
          const title = cleanText(i.title, 200) || 'Untitled'
          const sev = cleanText(i.severity, 30) || 'medium'
          const cls = severityClass(sev)
          return `<li><span class="badge ${escapeHtml(cls)}">${escapeHtml(sev)}</span>${escapeHtml(title)}</li>`
        })
        .join('')}</ul>`
    : '<p class="meta">No active focus items right now.</p>'

  const lessonUrl = data.awarenessLesson ? `${site}/awareness/${data.awarenessLesson.slug}` : `${site}/awareness`
  const lessonHtml = data.awarenessLesson
    ? [
        `<p><strong>${escapeHtml(cleanText(data.awarenessLesson.title, 200) || 'Lesson learned')}</strong></p>`,
        `<p><a href="${escapeHtml(lessonUrl)}">Read more →</a></p>`
      ].join('')
    : `<p class="meta">No new awareness lesson this week.</p><p><a href="${escapeHtml(lessonUrl)}">Browse awareness lessons →</a></p>`

  const podcastUrl = `${site}/podcast`
  const podcastHtml = data.latestPodcast
    ? [
        `<p><strong>${escapeHtml(cleanText(data.latestPodcast.title, 200) || 'Latest podcast')}</strong></p>`,
        `<p class="meta">${escapeHtml(cleanText(data.latestPodcast.date, 40) || '')}</p>`,
        `<p><a href="${escapeHtml(podcastUrl)}" class="button">Listen</a></p>`
      ].join('')
    : `<p class="meta">No podcast episode found.</p><p><a href="${escapeHtml(podcastUrl)}">Browse podcast →</a></p>`

		const youtubeUrl = (process.env.NUXT_PUBLIC_SOCIAL_YOUTUBE_URL || '').trim()
		const youtubeHtml = youtubeUrl
			? `
				<div class="card">
				  <h2 style="color:#ffffff; font-size:18px; margin:0 0 12px;">Watch on YouTube</h2>
				  <p style="color:#94a3b8; line-height:1.6; margin:0 0 12px;">Red vs Blue Show episodes, podcast video versions, and security explainers.</p>
				  <p style="margin:0;"><a href="${escapeHtml(youtubeUrl)}" class="button" style="background:#ff0000; color:#ffffff !important;">Open YouTube channel</a></p>
				</div>
			`
			: ''

  const events = (data.upcomingEvents || []).slice(0, 2)
  const eventsHtml = events.length
    ? `<ul>${events
        .map((e) => {
          const title = cleanText(e.title, 200) || 'Event'
          const date = cleanText(e.date, 40) || ''
          return `<li><strong>${escapeHtml(title)}</strong>${date ? ` <span class="meta">(${escapeHtml(date)})</span>` : ''}</li>`
        })
        .join('')}</ul>`
    : '<p class="meta">No events in the next 7 days.</p>'

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
	  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <p class="meta">${escapeHtml(data.weekLabel)}</p>
    ${taglineHtml}

    ${executiveSummaryCardHtml}

    <div class="card">
      ${coverImgHtml}
      <h1>This week's roundup</h1>
      ${tldrHtml || '<p class="meta">No TL;DR available for the latest roundup.</p>'}
      <p><a href="${escapeHtml(weeklyUrl)}" class="button">Read the full roundup</a></p>
    </div>

    <div class="card">
      <h2>Active focus items</h2>
      ${focusHtml}
    </div>

    <div class="card">
      <h2>Lesson learned</h2>
      ${lessonHtml}
    </div>

    <div class="card">
      <h2>Latest podcast</h2>
      ${podcastHtml}
    </div>

		${youtubeHtml}

    <div class="card">
      <h2>Events ahead</h2>
      ${eventsHtml}
    </div>

    ${footerHtml({ siteUrl: site, unsubscribeUrl: data.unsubscribeUrl })}
  </div>
</body></html>
  `.trim()

	const youtubeTextLines = youtubeUrl
	  ? ['', 'YouTube channel', 'Red vs Blue Show, podcast video versions, and security explainers', youtubeUrl, '']
	  : []

	const text = [
    `Your week in security — ${data.weekLabel}`,
		tagline ? `Tagline: ${tagline}` : '',
		executiveSummary ? `Executive summary\n${executiveSummary}` : '',
    '',
    "This week's roundup",
    tldr ? `TL;DR\n${tldr}` : '(No TL;DR available)',
    `Read the full roundup: ${weeklyUrl}`,
    '',
    'Active focus items',
    focus.length
      ? focus.map((i) => `- [${(i.severity || '').toUpperCase()}] ${i.title}`).join('\n')
      : '(No active focus items)',
    '',
    'Lesson learned',
    data.awarenessLesson ? `${data.awarenessLesson.title}\n${lessonUrl}` : `Browse: ${lessonUrl}`,
    '',
	    'Latest podcast',
	    data.latestPodcast ? `${data.latestPodcast.title} (${data.latestPodcast.date})\n${podcastUrl}` : `Browse: ${podcastUrl}`,
	    ...youtubeTextLines,
    'Events ahead',
    events.length ? events.map((e) => `- ${e.title}${e.date ? ` (${e.date})` : ''}`).join('\n') : '(No events in the next 7 days)',
    '',
    `Manage preferences: ${site}/subscribe`,
    `Unsubscribe: ${data.unsubscribeUrl}`
  ].join('\n')

  return { subject, html, text }
}
