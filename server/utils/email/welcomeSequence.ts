import { DEFAULT_SITE_URL } from '../../../shared/siteDefaults'

import { getSiteConfig } from '../siteConfig'

type WelcomeLesson = { title: string; slug: string; excerpt: string }

const BASE_STYLES = `
<style>
  body { background: #0e131f; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .logo { color: #4cd7f6; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  .card { background: #161c28; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin: 16px 0; }
  h1 { color: #ffffff; font-size: 24px; margin: 0 0 8px; }
  p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
  a { color: #4cd7f6; }
  .button { display: inline-block; background: #4cd7f6; color: #0e131f !important; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }
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

function footerHtml(data: WelcomeTemplateData): string {
	const siteConfig = getSiteConfig()
	const siteName = escapeHtml(siteConfig.name)

  const site = normalizeSiteUrl(data.siteUrl)
  const manageUrl = (data.manageUrl || '').trim() || `${site}/subscribe`
  const unsubUrl = (data.unsubscribeUrl || '').trim() || site
  const safeManage = escapeHtml(manageUrl)
  const safeUnsub = escapeHtml(unsubUrl)

  return [
    `<div class="footer">`,
	  `You're receiving this because you signed up for ${siteName} at ${escapeHtml(site)}<br>`,
    `<a href="${safeManage}">Manage preferences</a> · <a href="${safeUnsub}">Unsubscribe</a>`,
    `</div>`
  ].join('')
}

export type WelcomeTemplateData = {
  email: string
  siteUrl?: string | null
  manageUrl?: string | null
  unsubscribeUrl: string

  latestPodcastTitle?: string | null
  latestPodcastUrl?: string | null

  latestWeeklyLabel?: string | null
  latestWeeklySlug?: string | null
  latestWeeklyTldr?: string | null

  topAwarenessLessons?: WelcomeLesson[]
}

export function renderWelcomeDay0(data: WelcomeTemplateData) {
	const siteConfig = getSiteConfig()
	const subject = `Welcome to ${siteConfig.name}. Here's what you get.`
  const site = normalizeSiteUrl(data.siteUrl)
  const podcastUrl = (data.latestPodcastUrl || '').trim() || `${site}/podcast`

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <div class="card">
      <h1>Welcome aboard.</h1>
	      <p>Glad you're here. ${escapeHtml(siteConfig.name)} is a curated security intelligence feed for practitioners — built to cut through the noise and give you the signal that matters.</p>
      <p><strong>Here's what you get, free during beta:</strong></p>
      <p>
        📢 <strong>Daily podcast</strong> — morning and afternoon briefings<br>
        📋 <strong>Weekly roundup</strong> — practitioner-grade threat summary every Monday<br>
        🚨 <strong>Focus items</strong> — what your blue team should prioritize today<br>
        🔎 <strong>IOC search</strong> — indicators across 1,000+ sources<br>
        🤖 <strong>MCP server</strong> — IOCs in your Claude workflow
      </p>
      ${data.latestPodcastTitle
        ? `<p><strong>Start here:</strong> Latest podcast — <a href="${escapeHtml(podcastUrl)}">${escapeHtml(data.latestPodcastTitle)}</a></p>`
        : `<p><a href="${escapeHtml(podcastUrl)}" class="button">Listen to the latest podcast</a></p>`}
    </div>
    ${footerHtml(data)}
  </div>
</body></html>
  `.trim()

  const manageUrl = (data.manageUrl || '').trim() || `${site}/subscribe`
  const text = [
	  `Welcome to ${siteConfig.name}.`,
    "",
    "Here's what you get, free during beta:",
    "- Daily podcast (morning + afternoon)",
    "- Weekly roundup every Monday",
    "- Focus items for blue teams",
    "- IOC search",
    "- MCP server for Claude",
    "",
    `Start with the latest podcast: ${podcastUrl}`,
    "",
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${data.unsubscribeUrl}`
  ].join('\n')

  return { subject, html, text }
}

export function renderWelcomeDay2(data: WelcomeTemplateData) {
	const siteConfig = getSiteConfig()
  const subject = 'Your first weekly roundup'
  const site = normalizeSiteUrl(data.siteUrl)
  const weeklyUrl = data.latestWeeklySlug ? `${site}/weekly/${data.latestWeeklySlug}` : `${site}/weekly`
  const tldr = (data.latestWeeklyTldr || '').trim()

  const tldrHtml = tldr
    ? `<p><strong>TL;DR</strong><br>${escapeHtml(tldr).replace(/\n/g, '<br>')}</p>`
    : ''

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <div class="card">
      <h1>Your first weekly roundup</h1>
      <p>Every Monday we publish a weekly threat roundup — a practitioner-focused summary of the week's biggest security stories. No hype, just what mattered.</p>
      ${data.latestWeeklyLabel ? `<p><strong>Latest: ${escapeHtml(data.latestWeeklyLabel)}</strong></p>` : ''}
      ${tldrHtml}
      <p><a href="${escapeHtml(weeklyUrl)}" class="button">Read the latest roundup</a></p>
      <p>Reply to this email and tell me what topics matter most to you — I read every reply.</p>
    </div>
    ${footerHtml(data)}
  </div>
</body></html>
  `.trim()

  const manageUrl = (data.manageUrl || '').trim() || `${site}/subscribe`
  const text = [
    'Your first weekly roundup',
    '',
    "Every Monday we publish a practitioner-focused weekly threat roundup.",
    '',
    data.latestWeeklyLabel ? `Latest: ${data.latestWeeklyLabel}` : 'Latest weekly roundup:',
    weeklyUrl,
    '',
    tldr ? `TL;DR\n${tldr}` : '',
    'Reply and tell me what topics matter to you.',
    '',
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${data.unsubscribeUrl}`
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

export function renderWelcomeDay5(data: WelcomeTemplateData) {
	const siteConfig = getSiteConfig()
  const subject = 'Lessons from the biggest incidents'
  const site = normalizeSiteUrl(data.siteUrl)
  const lessons = (data.topAwarenessLessons || []).slice(0, 3)

  const lessonsHtml = lessons
    .map((l) => {
      const url = `${site}/awareness/${l.slug}`
      return `<p><strong><a href="${escapeHtml(url)}">${escapeHtml(l.title)}</a></strong><br>${escapeHtml(l.excerpt)}</p>`
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <div class="card">
      <h1>Learn from what actually happened</h1>
	      <p>Every ${escapeHtml(siteConfig.name)} awareness lesson is a root-cause takeaway from a real incident — something you can check for in your own environment before it happens to you.</p>
      ${lessonsHtml || '<p>Browse all lessons on the site.</p>'}
      <p><a href="${escapeHtml(`${site}/awareness`)}" class="button">Browse all awareness lessons</a></p>
    </div>
    ${footerHtml(data)}
  </div>
</body></html>
  `.trim()

  const manageUrl = (data.manageUrl || '').trim() || `${site}/subscribe`
  const text = [
    'Lessons from the biggest incidents',
    '',
    'Every awareness lesson is a root-cause takeaway from a real incident.',
    '',
    lessons.length
      ? lessons.map((l) => `- ${l.title}: ${site}/awareness/${l.slug}`).join('\n')
      : `Browse: ${site}/awareness`,
    '',
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${data.unsubscribeUrl}`
  ].join('\n')

  return { subject, html, text }
}

export function renderWelcomeDay10(data: WelcomeTemplateData) {
	const siteConfig = getSiteConfig()
  const subject = 'Get alerts in Discord, Telegram, or your webhook'
  const site = normalizeSiteUrl(data.siteUrl)

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <div class="card">
      <h1>Go beyond email</h1>
	      <p>Email is great, but if you're in a SOC or dev team, ${escapeHtml(siteConfig.name)} pushes alerts to where you actually work:</p>
      <p>
        💬 <strong>Discord webhook</strong> — drop alerts into your team channel<br>
        📱 <strong>Telegram</strong> — get them on your phone<br>
        🔗 <strong>Custom webhook</strong> — route to Slack, Teams, PagerDuty, anywhere<br>
        🤖 <strong>MCP server</strong> — IOC lookups inside Claude, Cursor, or any MCP client
      </p>
      <p><a href="${escapeHtml(`${site}/subscribe`)}" class="button">Set up channels</a></p>
      <p>Developers: grab an API key at <a href="${escapeHtml(`${site}/developer`)}">${escapeHtml(`${site}/developer`)}</a> to plug IOCs into your own tooling.</p>
    </div>
    ${footerHtml(data)}
  </div>
</body></html>
  `.trim()

  const manageUrl = (data.manageUrl || '').trim() || `${site}/subscribe`
  const text = [
    'Go beyond email',
    '',
	  `${siteConfig.name} pushes alerts to Discord, Telegram, custom webhooks, and MCP clients.`,
    '',
    `Set up channels: ${site}/subscribe`,
    `Developers: ${site}/developer`,
    '',
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${data.unsubscribeUrl}`
  ].join('\n')

  return { subject, html, text }
}

export function renderWeeklyRoundupNotification(data: {
  email: string
  siteUrl?: string | null
  unsubscribeUrl: string
  weeklyLabel: string
  weeklySlug: string
  weeklyTldr: string
}): { subject: string; html: string; text: string } {
  const site = normalizeSiteUrl(data.siteUrl)
  const weeklyUrl = `${site}/weekly/${escapeHtml(data.weeklySlug)}`

	const siteConfig = getSiteConfig()
	const subject = `${siteConfig.name} Weekly Roundup: ${data.weeklyLabel}`
  const tldr = (data.weeklyTldr || '').trim()
  const tldrHtml = tldr
    ? `<p><strong>TL;DR</strong><br>${escapeHtml(tldr).replace(/\n/g, '<br>')}</p>`
    : ''

  const footer = footerHtml({
    email: data.email,
    siteUrl: site,
    manageUrl: `${site}/subscribe`,
    unsubscribeUrl: data.unsubscribeUrl
  })

  const html = `
<!DOCTYPE html>
<html><head>${BASE_STYLES}</head><body>
  <div class="wrapper">
	    <div class="logo">${escapeHtml(siteConfig.name)}</div>
    <div class="card">
      <h1>${escapeHtml(data.weeklyLabel)}</h1>
      <p>A new weekly roundup is live — practitioner-grade threat intelligence with the noise removed.</p>
      ${tldrHtml}
      <p><a href="${escapeHtml(weeklyUrl)}" class="button">Read the full roundup</a></p>
    </div>
    ${footer}
  </div>
</body></html>
  `.trim()

  const text = [
	  `${siteConfig.name} Weekly Roundup: ${data.weeklyLabel}`,
    '',
    'A new weekly roundup is live.',
    '',
    `Read the full roundup: ${weeklyUrl}`,
    '',
    tldr ? `TL;DR\n${tldr}` : '',
    '',
    `Unsubscribe: ${data.unsubscribeUrl}`
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}
