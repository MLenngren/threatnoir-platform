import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { getSiteConfig } from '../../utils/siteConfig'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  // Strict rate limit: 2 signups per day per IP to prevent spam
  const { allowed } = checkRateLimit(`podcast-interest:${ip}`, 2, 24 * 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again tomorrow.' })
  }

  const body = await readBody(event)
  const rawEmail = typeof body?.email === 'string' ? body.email : ''
  const email = rawEmail.trim().toLowerCase().slice(0, 254) // RFC 5321 max
  if (!email || email.length < 5 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  // Sanitize delivery preferences — max 5 items, max 50 chars each, alphanumeric only
  const VALID_DELIVERY = new Set(['email', 'rss', 'spotify', 'apple-podcasts'])
  const preferences: Record<string, unknown> = {}
  if (Array.isArray(body?.delivery)) {
    preferences.delivery = body.delivery
      .filter((d: unknown) => typeof d === 'string' && VALID_DELIVERY.has(d))
      .slice(0, 5)
  }

  const supabase = serverSupabaseServiceRole(event)

  // Check if already signed up
  const { data: existing } = await supabase
    .from('podcast_interest')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Already signed up — just return success, don't send another email
    return { success: true, already: true }
  }

  const { error } = await supabase
    .from('podcast_interest')
    .insert({ email, preferences })

  if (error) {
    // Handle race condition (duplicate insert)
    if ((error as { code?: string }).code === '23505') {
      return { success: true, already: true }
    }
    console.error('[podcast/extended-signup] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Send confirmation email only for NEW signups
  try {
	  const site = getSiteConfig()
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'ThreatNoir <noreply@threatnoir.com>',
      to: email,
	    subject: `You're on the list — ${site.name} Extended Podcast`,
      html: [
        '<div style="font-family:sans-serif;color:#e2e8f0;background:#030712;padding:32px;border-radius:12px;">',
        '<h1 style="color:#fff;font-size:24px;margin:0 0 16px;">You\'re on the list!</h1>',
	      `<p style="color:#94a3b8;line-height:1.6;">Thanks for signing up for the ${site.name} Extended Podcast Edition.</p>`,
        '<p style="color:#94a3b8;line-height:1.6;">We\'ll notify you when the 20-minute deep-dive edition launches — covering more stories with detailed analysis, expert context, and actionable takeaways.</p>',
        '<p style="color:#94a3b8;line-height:1.6;">In the meantime, check out our daily briefings:</p>',
	      `<p><a href="${site.url}/podcast" style="color:#06b6d4;text-decoration:none;font-weight:600;">Listen to today's briefing →</a></p>`,
        '<hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">',
	      `<p style="color:#64748b;font-size:12px;">${site.name} — Security intelligence, curated for practitioners.</p>`,
        '</div>'
      ].join('')
    })
  } catch (err) {
    // Don't fail the signup if email fails — just log it
    console.error('[podcast/extended-signup] Email error:', err)
  }

  return { success: true }
})
