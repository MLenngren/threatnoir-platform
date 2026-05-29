import { Resend } from 'resend'

import { emailRecipients, emailSenders } from './emailConfig'
import { getSiteConfig } from './siteConfig'

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

	const site = getSiteConfig()

  const subjects: Record<AdminEvent, string> = {
	  user_signup: `${site.name}: New user signup — ${details.email || 'unknown'}`,
	  api_key_created: `${site.name}: API key created — ${details.email || 'unknown'}`,
	  api_key_revoked: `${site.name}: API key revoked — ${details.email || 'unknown'}`,
	  contact_form: `${site.name}: Contact form — ${details.subject || 'unknown'}`,
	  weekly_roundup_ready: `${site.name}: Weekly Roundup draft ready — ${details.week_label || 'unknown'}`,
		social_draft_ready: `${site.name}: Social draft ready — ${details.hook || details.id || 'unknown'}`,
		event_submitted: `${site.name}: Event submitted — ${details.title || 'unknown'}`,
		focus_item_created: `${site.name}: Focus item created — ${details.title || 'unknown'}`
  }

  const body = Object.entries(details)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 12px;">${escapeHtml(v)}</td></tr>`
    )
    .join('')

	const subject = subjects[eventType] || `${site.name}: ${eventType}`

	const html = `<div style="font-family:sans-serif;max-width:500px;">
    <h3 style="margin:0 0 12px;">${escapeHtml(subject)}</h3>
    <table style="border-collapse:collapse;width:100%;">${body}</table>
	  <p style="margin-top:16px;font-size:12px;color:#888;">${escapeHtml(site.name)} Admin Notification</p>
  </div>`

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
		  from: emailSenders.notifications(),
		  to: emailRecipients.adminNotifications(),
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
