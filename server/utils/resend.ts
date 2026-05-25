import { Resend } from 'resend'

export type ArticleData = {
  id: string
  title: string
  brief: string | null
  url: string
  regulation: string | null
  jurisdiction: string | null
  fine_amount: string | null
  published_at: string | null
}

function getResendClient(): Resend {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const to = (email || '').trim()
  const verifyToken = (token || '').trim()
  if (!to) throw new Error('Missing email')
  if (!verifyToken) throw new Error('Missing token')

  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
  const verifyUrl = `${siteUrl.replace(/\/$/, '')}/api/subscribe/verify?token=${encodeURIComponent(verifyToken)}`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;font-weight:900;color:#4cd7f6;">ThreatNoir</div>

    <div style="margin-top:20px;background:#161c28;border:1px solid #1e293b;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px 0;font-size:22px;line-height:28px;color:#ffffff;font-weight:800;">One more step</h1>
      <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#94a3b8;">
        Click the button below to verify your email and activate your ThreatNoir subscription.
      </p>

      <div style="margin:24px 0;">
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#4cd7f6;color:#0b0f19;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">
          Verify my subscription
        </a>
      </div>

      <p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#64748b;">
        Or copy this link into your browser:<br>
        <a href="${verifyUrl}" style="color:#4cd7f6;word-break:break-all;">${verifyUrl}</a>
      </p>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #1e293b;">
        <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;">
          Once verified, you'll get:
        </p>
        <ul style="margin:8px 0 0 0;padding-left:18px;font-size:12px;line-height:20px;color:#94a3b8;">
          <li>Daily 5-minute security briefings (podcast)</li>
          <li>Weekly threat roundup every Monday</li>
          <li>Active focus items for blue teams</li>
          <li>Optional alerts via Discord, Telegram, or webhook</li>
        </ul>
      </div>
    </div>

    <div style="margin-top:20px;font-size:12px;line-height:18px;color:#64748b;text-align:center;">
      If you didn't request this, you can safely ignore this email.<br>
      ThreatNoir · <a href="${siteUrl}" style="color:#64748b;">threatnoir.com</a>
    </div>
  </div>
</body></html>
  `.trim()

  const text = `Verify your ThreatNoir subscription\n\nClick this link to verify:\n${verifyUrl}\n\nOnce verified, you'll get daily briefings, weekly roundups, and focus items.\n\nIf you didn't request this, you can safely ignore this email.\n\nThreatNoir · threatnoir.com`

  const resend = getResendClient()
  await resend.emails.send({
    from: 'ThreatNoir <noreply@threatnoir.com>',
    to,
    subject: 'Verify your ThreatNoir subscription',
    html,
    text
  })
}

export async function sendWelcomeEmail(params: {
  to: string
  subject: string
  html: string
  text?: string | null
}): Promise<void> {
  const to = (params.to || '').trim()
  if (!to) throw new Error('Missing email')

  const subject = (params.subject || '').trim()
  if (!subject) throw new Error('Missing subject')

  const html = (params.html || '').trim()
  if (!html) throw new Error('Missing html')

  const resend = getResendClient()
  await resend.emails.send({
    from: 'ThreatNoir <welcome@threatnoir.com>',
    to,
    subject,
    html,
    text: (params.text || '').trim() || undefined
  })
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

function buildNotificationHtml(article: ArticleData, unsubscribeUrl: string): string {
  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
  const tnUrl = siteUrl.replace(/\/$/, '')

  const titleRaw = (article?.title || '').trim()
  const briefRaw = (article?.brief || '').trim()
  const regulationRaw = (article?.regulation || '').trim()
  const jurisdictionRaw = (article?.jurisdiction || '').trim()
  const fineRaw = (article?.fine_amount || '').trim()

  const title = escapeHtml(titleRaw)
  const brief = escapeHtml(briefRaw)

  const sourceUrl = (article?.url || '').trim()
  const safeSourceUrl = sourceUrl ? sourceUrl : tnUrl
  const safeUnsubUrl = (unsubscribeUrl || '').trim() || tnUrl

  const badge = (label: string, value: string) =>
    `<span style="display:inline-block;margin-right:8px;margin-top:8px;padding:4px 10px;border-radius:999px;background:#111827;color:#E5E7EB;font-size:12px;line-height:18px;border:1px solid #374151;">` +
	  `<strong style="font-weight:600;color:#F9FAFB">${escapeHtml(label)}:</strong> ${escapeHtml(value)}` +
    `</span>`

  return (
    `<div style="background:#0B0F19;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">` +
    `<div style="max-width:640px;margin:0 auto;background:#0F172A;border:1px solid #1F2937;border-radius:16px;overflow:hidden;">` +
    `<div style="padding:22px 22px 18px 22px;">` +
    `<div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;">ThreatNoir</div>` +
    `<h1 style="margin:10px 0 0 0;font-size:18px;line-height:26px;color:#F9FAFB;">` +
    `<a href="${escapeHtml(safeSourceUrl)}" style="color:#F9FAFB;text-decoration:none;">${brief || title || 'New article'}</a>` +
    `</h1>` +
    (brief && title && brief !== title
      ? `<div style="margin-top:10px;font-size:13px;line-height:20px;color:#CBD5E1;">${title}</div>`
      : '') +
    `<div style="margin-top:12px;font-size:14px;line-height:22px;color:#D1D5DB;">` +
    `${brief || ''}` +
    `</div>` +
    `<div style="margin-top:12px;">` +
    (regulationRaw ? badge('Regulation', regulationRaw) : '') +
    (jurisdictionRaw ? badge('Jurisdiction', jurisdictionRaw) : '') +
    (fineRaw ? badge('Fine', fineRaw) : '') +
    `</div>` +
    `<div style="margin-top:16px;">` +
    `<a href="${escapeHtml(safeSourceUrl)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111827;color:#F9FAFB;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #374151;">Open original</a>` +
    `<span style="display:inline-block;width:10px;"></span>` +
    `<a href="${escapeHtml(tnUrl)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#0B1220;color:#E5E7EB;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #334155;">View on ThreatNoir</a>` +
    `</div>` +
    `</div>` +
    `<div style="padding:16px 22px;border-top:1px solid #1F2937;background:#0B1220;">` +
    `<div style="font-size:12px;line-height:18px;color:#9CA3AF;">` +
    `You’re receiving this because you subscribed to ThreatNoir notifications.` +
    `</div>` +
    `<div style="margin-top:10px;font-size:12px;line-height:18px;color:#9CA3AF;">` +
    `<a href="${escapeHtml(safeUnsubUrl)}" style="color:#93C5FD;text-decoration:underline;">Unsubscribe</a>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>`
  )
}

export async function sendNotificationEmail(
  toRaw: string,
  article: ArticleData,
  unsubscribe: { subscriberId: string; verifyToken: string }
): Promise<void> {
  const to = (toRaw || '').trim()
  if (!to) throw new Error('Missing email')

  const subscriberId = (unsubscribe?.subscriberId || '').trim()
  const token = (unsubscribe?.verifyToken || '').trim()
  if (!subscriberId) throw new Error('Missing subscriberId')
  if (!token) throw new Error('Missing verifyToken')

  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
  const base = siteUrl.replace(/\/$/, '')
  const unsubscribeUrl = `${base}/api/subscribe/${encodeURIComponent(subscriberId)}?token=${encodeURIComponent(token)}`

  const resend = getResendClient()
  await resend.emails.send({
    from: 'ThreatNoir <notifications@threatnoir.com>',
    to,
    subject: `ThreatNoir: ${(article?.brief || article?.title || 'New article').trim()}`,
    html: buildNotificationHtml(article, unsubscribeUrl)
  })
}
