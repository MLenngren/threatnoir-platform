import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, defineEventHandler, getHeader, getQuery, type H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { sendWelcomeEmail } from '../../utils/resend'
import { renderWeeklyDigest } from '../../utils/email/weeklyDigest'
import { renderWeeklyDigestPlaintextFallback } from '../../utils/email/weeklyDigestPlaintextFallback'
import { pingOps } from '../../utils/discordOps'
import { isoWeekLabel } from '../../utils/isoWeek'

function getWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `Week ${weekNo}, ${d.getUTCFullYear()}`
}

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRON_SECRET is not configured'
    })
  }

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function severityWeight(sev: string): number {
  const s = (sev || '').trim().toLowerCase()
  if (s === 'critical') return 3
  if (s === 'high') return 2
  if (s === 'medium') return 1
  return 0
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

function cleanMarkdown(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null
  const normalized = v
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return null
  if (normalized.length <= maxLen) return normalized
  return normalized.slice(0, Math.max(0, maxLen - 1)).trim() + '…'
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  try {
    const q = getQuery(event)
    const force = typeof q.force === 'string' && q.force.trim().toLowerCase() === 'true'

    const now = new Date()
    const isSundayUtc = now.getUTCDay() === 0
    if (!isSundayUtc && !force) {
      return { skipped: true, reason: 'not Sunday' }
    }

    const supabase = serverSupabaseServiceRole(event)

    const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
    const base = siteUrl.replace(/\/$/, '')

    const todayIso = toIsoDate(now)
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    end.setUTCDate(end.getUTCDate() + 7)
    const endIso = toIsoDate(end)
    const cutoffIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const [weeklyRes, focusRes, lessonRes, podRes, eventsRes] = await Promise.all([
      supabase
        .from('weekly_roundups')
				.select('week_label,slug,tldr,executive_summary,tagline,cover_image_url,published_at,created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('focus_items')
        .select('title,severity,created_at,expires_at,status')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('awareness_lessons')
        .select('slug,title,published_at,created_at')
        .eq('status', 'published')
        .gte('published_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('podcast_episodes')
        .select('title,date,created_at')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('events')
        .select('title,start_date,status')
        .eq('status', 'approved')
        .gte('start_date', todayIso)
        .lte('start_date', endIso)
        .order('start_date', { ascending: true })
        .limit(2)
    ])

  if (weeklyRes.error) {
    console.error('[cron/weekly-digest] DB error (weekly_roundups):', weeklyRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (focusRes.error) {
    console.error('[cron/weekly-digest] DB error (focus_items):', focusRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (lessonRes.error) {
    console.error('[cron/weekly-digest] DB error (awareness_lessons):', lessonRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (podRes.error) {
    console.error('[cron/weekly-digest] DB error (podcast_episodes):', podRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (eventsRes.error) {
    console.error('[cron/weekly-digest] DB error (events):', eventsRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const weeklyRow = (weeklyRes.data ?? [])[0] as Record<string, unknown> | undefined
		const latestPublishedWeekLabel = typeof weeklyRow?.week_label === 'string' ? weeklyRow.week_label.trim() : ''
  const weeklySlug = cleanText(weeklyRow?.slug, 80) || null
	const weeklyTldr = cleanMarkdown(weeklyRow?.tldr, 900)
	const executiveSummary = cleanMarkdown(weeklyRow?.executive_summary, 6000) || undefined
	const tagline = cleanText(weeklyRow?.tagline, 200) || null
	const coverImageUrlRaw = typeof weeklyRow?.cover_image_url === 'string' ? weeklyRow.cover_image_url.trim() : ''
	const coverImageUrl = coverImageUrlRaw ? coverImageUrlRaw : null

		// ---------------------------------------------------------------------------
		// Sanity check: refuse to send if the latest published roundup is not for the
		// current ISO week. This prevents subject/body mismatches if roundup
		// generation fails and the DB still points at last week.
		// ---------------------------------------------------------------------------

		const currentIsoWeekLabel = isoWeekLabel(now)
		if (latestPublishedWeekLabel !== currentIsoWeekLabel) {
			console.error(
				`[weekly-digest] aborting: latest published roundup is ${latestPublishedWeekLabel || '(none)'}, current ISO week is ${currentIsoWeekLabel}. Subscribers will NOT be emailed this week.`
			)

			await pingOps(
				`🚨 ThreatNoir weekly digest SKIPPED. Latest published roundup is ${latestPublishedWeekLabel || '(none)'}, current ISO week is ${currentIsoWeekLabel}. Generation must succeed before subscribers are notified.\n` +
					`Manual recovery: POST /api/cron/generate-weekly-roundup, then POST /api/cron/weekly-digest, then if a bad digest already went out, POST /api/cron/weekly-digest-correction?week=${encodeURIComponent(currentIsoWeekLabel)}.`
			)

			return {
				skipped: true,
				reason: 'week_mismatch',
				latest_week: latestPublishedWeekLabel || null,
				current_week: currentIsoWeekLabel
			}
		}

  const focusItems = ((focusRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      title: cleanText(r.title, 200) || '',
      severity: cleanText(r.severity, 30) || 'medium',
      created_at: typeof r.created_at === 'string' ? r.created_at : ''
    }))
    .filter((r) => Boolean(r.title))
    .sort((a, b) => {
      const ws = severityWeight(b.severity) - severityWeight(a.severity)
      if (ws !== 0) return ws
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
    .slice(0, 3)
    .map(({ title, severity }) => ({ title, severity }))

  const lessonRow = (lessonRes.data ?? [])[0] as Record<string, unknown> | undefined
  const awarenessLesson = lessonRow?.slug && lessonRow?.title
    ? {
        slug: cleanText(lessonRow.slug, 120),
        title: cleanText(lessonRow.title, 200)
      }
    : null

  const podRow = (podRes.data ?? [])[0] as Record<string, unknown> | undefined
  const latestPodcast = podRow?.title && podRow?.date
    ? {
        title: cleanText(podRow.title, 200),
        date: cleanText(podRow.date, 40)
      }
    : null

  const upcomingEvents = ((eventsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      title: cleanText(r.title, 200) || '',
      date: cleanText(r.start_date, 40) || ''
    }))
    .filter((e) => Boolean(e.title))
    .slice(0, 2)

  // ---------------------------------------------------------------------------
  // Fetch verified subscribers with weekly digest enabled + active verified email
  // ---------------------------------------------------------------------------

  const eligible: Array<{ id: string; email: string; verify_token: string }> = []
  const pageSize = 500
  let offset = 0

  while (true) {
    const subsRes = await supabase
      .from('subscribers')
      .select('id,email,verify_token,verified,weekly_digest_enabled')
      .eq('verified', true)
      .eq('weekly_digest_enabled', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (subsRes.error) {
      console.error('[cron/weekly-digest] DB error (subscribers):', subsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const subs = (subsRes.data ?? []) as Array<Record<string, unknown>>
    if (subs.length === 0) break

    const ids = subs.map((s) => (typeof s.id === 'string' ? s.id : '')).filter(Boolean)

    const channelsRes = ids.length
      ? await supabase
          .from('subscriber_channels')
          .select('subscriber_id')
          .eq('channel_type', 'email')
          .eq('is_active', true)
          .eq('verified', true)
          .in('subscriber_id', ids)
      : { data: [], error: null }

    if (channelsRes.error) {
      console.error('[cron/weekly-digest] DB error (subscriber_channels):', channelsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const okEmail = new Set<string>()
    for (const r of (channelsRes.data ?? []) as Array<Record<string, unknown>>) {
      const id = typeof r.subscriber_id === 'string' ? r.subscriber_id : ''
      if (id) okEmail.add(id)
    }

    for (const s of subs) {
      const id = typeof s.id === 'string' ? s.id : ''
      const email = typeof s.email === 'string' ? s.email : ''
      const token = typeof s.verify_token === 'string' ? s.verify_token : ''
      if (!id || !email || !token) continue
      if (!okEmail.has(id)) continue
      eligible.push({ id, email, verify_token: token })
    }

    offset += subs.length
    if (subs.length < pageSize) break
  }

  const weekLabel = getWeekLabel(now)
  const total = eligible.length

  let sent = 0
  let failed = 0
  let renderFallbackNotified = false

  const chunkSize = 50
  for (let i = 0; i < eligible.length; i += chunkSize) {
    const batch = eligible.slice(i, i + chunkSize)
    console.log(`[cron/weekly-digest] sending batch ${i / chunkSize + 1} (${batch.length} recipients)`)

    for (const sub of batch) {
      const unsubscribeUrl = `${base}/api/subscribe/${encodeURIComponent(sub.id)}?token=${encodeURIComponent(sub.verify_token)}`

      const digestParams = {
        email: sub.email,
        siteUrl: base,
        unsubscribeUrl,
        weekLabel,
        weeklySlug,
        weeklyTldr,
        executiveSummary: executiveSummary || undefined,
        tagline: tagline || undefined,
        coverImageUrl: coverImageUrl || undefined,
        focusItems,
        awarenessLesson,
        latestPodcast,
        upcomingEvents
      }

      let rendered: { subject: string; html: string; text: string }
      try {
        rendered = renderWeeklyDigest(digestParams)
      } catch (err: unknown) {
        console.error('[weekly-digest] render failed, falling back to plaintext:', err)
        if (!renderFallbackNotified) {
          renderFallbackNotified = true
          await pingOps(
            '🚨 ThreatNoir weekly digest render failed, sent plaintext fallback. Investigate the markdown that broke marked.'
          )
        }
        rendered = renderWeeklyDigestPlaintextFallback(digestParams)
      }

      try {
        await sendWelcomeEmail({
          to: sub.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text
        })
        sent += 1
      } catch (err: unknown) {
        failed += 1
        console.warn('[cron/weekly-digest] send failed:', err instanceof Error ? err.message : String(err))
      }
    }
  }

    console.log(`[cron/weekly-digest] done: ${sent} sent, ${failed} failed (total ${total})`)

    if (sent > 0 || failed > 0) {
      await pingOps(
        `✅ Sunday digest sent\n` +
          `Recipients: ${sent}/${total}` +
          (failed > 0 ? `\nFailed: ${failed}` : '')
      )
    }

    return { sent, failed, total_subscribers: total }
  } catch (err) {
    await pingOps(
      `🚨 Sunday digest cron FAILED\n` +
        `Reason: ${err instanceof Error ? err.message : String(err)}`
    )
    throw err
  }
})
