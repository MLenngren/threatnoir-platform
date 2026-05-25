import { Resend } from 'resend'

type AdminEvent =
  | 'user_signup'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'contact_form'
  | 'weekly_roundup_ready'
  | 'social_draft_ready'
  | 'event_submitted'
  | 'focus_item_created'

/**
 * Send an admin notification email.
 *
 * Non-blocking: this function never throws. Failures are caught + logged.
 */
export async function notifyAdmin(eventType: AdminEvent, details: Record<string, string>): Promise<void> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('[notifyAdmin] RESEND_API_KEY not configured, skipping notification')
    return
  }

  const subjects: Record<AdminEvent, string> = {
    user_signup: `ThreatNoir: New user signup — ${details.email || 'unknown'}`,
    api_key_created: `ThreatNoir: API key created — ${details.email || 'unknown'}`,
    api_key_revoked: `ThreatNoir: API key revoked — ${details.email || 'unknown'}`,
    contact_form: `ThreatNoir: Contact form — ${details.subject || 'unknown'}`,
    weekly_roundup_ready: `ThreatNoir: Weekly Roundup draft ready — ${details.week_label || 'unknown'}`,
		social_draft_ready: `ThreatNoir: Social draft ready — ${details.hook || details.id || 'unknown'}`,
		event_submitted: `ThreatNoir: Event submitted — ${details.title || 'unknown'}`,
		focus_item_created: `ThreatNoir: Focus item created — ${details.title || 'unknown'}`
  }

  const body = Object.entries(details)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 12px;">${escapeHtml(v)}</td></tr>`
    )
    .join('')

  const subject = subjects[eventType] || `ThreatNoir: ${eventType}`

  const html = `<div style="font-family:sans-serif;max-width:500px;">
    <h3 style="margin:0 0 12px;">${escapeHtml(subject)}</h3>
    <table style="border-collapse:collapse;width:100%;">${body}</table>
    <p style="margin-top:16px;font-size:12px;color:#888;">ThreatNoir Admin Notification</p>
  </div>`

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'ThreatNoir <noreply@threatnoir.com>',
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
      subject,
      html
    })
  } catch (e) {
    console.error('[notifyAdmin] Failed to send notification:', e instanceof Error ? e.message : e)
    // Never throw — notifications must not block user actions
  }
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[ch] ?? ch
  })
}
