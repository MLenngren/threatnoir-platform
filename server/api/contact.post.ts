import { Resend } from 'resend'
import { createError, defineEventHandler, readBody } from 'h3'

import { checkRateLimit, getClientIP } from '../utils/rateLimit'
import { EMAIL_REGEX, normalizeEmail, normalizeText } from '../utils/subscriptions'

type Body = {
  name?: unknown
  email?: unknown
  subject?: unknown
  message?: unknown
  website?: unknown // honeypot
}

const VALID_SUBJECTS = new Set(['General Inquiry', 'Bug Report', 'Legal Inquiry', 'Partnership'])

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[ch] ?? ch
  })
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`contact:${ip}`, 5, 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again later.' })
  }

  const body = await readBody<Body>(event)

  // Honeypot — bots fill hidden fields
  const honeypot = typeof body?.website === 'string' ? body.website.trim() : ''
  if (honeypot) {
    // Silently accept to not tip off the bot
    return { ok: true }
  }

  const email = normalizeEmail(body?.email)
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  const name = normalizeText(body?.name, 100)
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const subject = normalizeText(body?.subject, 40)
  if (!subject || !VALID_SUBJECTS.has(subject)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid subject' })
  }

  const message = normalizeText(body?.message, 4000)
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'Message is required' })
  }

  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY not configured')
    throw createError({ statusCode: 500, statusMessage: 'Mail service unavailable' })
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: 'ThreatNoir Contact <noreply@threatnoir.com>',
    to: process.env.ADMIN_EMAIL || 'admin@example.com',
    replyTo: email,
    subject: `[ThreatNoir Contact] ${subject}`,
    html:
      `<div style="font-family:sans-serif;max-width:600px;">` +
      `<h2 style="margin:0 0 16px;">New contact form submission</h2>` +
      `<table style="border-collapse:collapse;width:100%;">` +
      `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;width:100px;">From</td><td style="padding:8px 12px;">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>` +
      `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;">Subject</td><td style="padding:8px 12px;">${escapeHtml(subject)}</td></tr>` +
      `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;">IP</td><td style="padding:8px 12px;font-size:12px;color:#888;">${escapeHtml(ip)}</td></tr>` +
      `</table>` +
      `<div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap;">${escapeHtml(message)}</div>` +
      `</div>`
  })

  return { ok: true }
})