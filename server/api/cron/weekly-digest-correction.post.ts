import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, defineEventHandler, getHeader, getQuery, type H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { isoWeekLabel } from '../../utils/isoWeek'
import { sendWelcomeEmail } from '../../utils/resend'
import { renderWeeklyDigestEmail } from '../../utils/weeklyDigestEmail'
import { pingOps } from '../../utils/discordOps'
import { renderWeeklyDigestPlaintextFallback } from '../../utils/email/weeklyDigestPlaintextFallback'

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured' })
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

function humanWeekLabelFromIsoWeekLabel(week: string): string {
  const m = (week || '').trim().match(/^([0-9]{4})-W([0-9]{2})$/)
  if (!m) return week.trim() || 'Unknown week'
  const year = m[1]
  const weekNo = String(Number(m[2]))
  return `Week ${weekNo}, ${year}`
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const q = getQuery(event)
  const now = new Date()

  const requestedWeek = typeof q.week === 'string' ? q.week.trim() : ''
  const week = requestedWeek || isoWeekLabel(now)

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
      .eq('week_label', week)
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
    console.error('[cron/weekly-digest-correction] DB error (weekly_roundups):', weeklyRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (focusRes.error) {
    console.error('[cron/weekly-digest-correction] DB error (focus_items):', focusRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (lessonRes.error) {
    console.error('[cron/weekly-digest-correction] DB error (awareness_lessons):', lessonRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (podRes.error) {
    console.error('[cron/weekly-digest-correction] DB error (podcast_episodes):', podRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (eventsRes.error) {
    console.error('[cron/weekly-digest-correction] DB error (events):', eventsRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const weeklyRow = (weeklyRes.data ?? [])[0] as Record<string, unknown> | undefined
  if (!weeklyRow) {
    throw createError({
      statusCode: 404,
      statusMessage: `Weekly roundup is not published for ${week}`
    })
  }

  const weeklySlug = cleanText(weeklyRow?.slug, 80) || null
  const weeklyTldr = cleanMarkdown(weeklyRow?.tldr, 900)
  const executiveSummary = cleanMarkdown(weeklyRow?.executive_summary, 6000) || undefined
  const tagline = cleanText(weeklyRow?.tagline, 200) || null
  const coverImageUrlRaw = typeof weeklyRow?.cover_image_url === 'string' ? weeklyRow.cover_image_url.trim() : ''
  const coverImageUrl = coverImageUrlRaw ? coverImageUrlRaw : null

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
  // Eligible subscribers (weekly digest enabled + verified + active verified email)
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
      console.error('[cron/weekly-digest-correction] DB error (subscribers):', subsRes.error.message)
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
      console.error('[cron/weekly-digest-correction] DB error (subscriber_channels):', channelsRes.error.message)
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

  const weekLabel = humanWeekLabelFromIsoWeekLabel(week)
  const subject = `Correction - Your Week in Security: ${weekLabel}`
  const introText = `Earlier today we sent you a digest with the wrong content. Here's the correct ${weekLabel} roundup. Sorry for the confusion.`
  const introHtml = `<p style="color:#94a3b8; line-height:1.6; margin:12px 0 16px;">Earlier today we sent you a digest with the wrong content. Here is the correct ${weekLabel} roundup. Sorry for the confusion.</p>`

  const total = eligible.length
  let sent = 0
  let skipped = 0
  let renderFallbackNotified = false

  const chunkSize = 50
  for (let i = 0; i < eligible.length; i += chunkSize) {
    const batch = eligible.slice(i, i + chunkSize)
    console.log(`[cron/weekly-digest-correction] sending batch ${i / chunkSize + 1} (${batch.length} recipients) for ${week}`)

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
        rendered = renderWeeklyDigestEmail({
          digest: digestParams,
          subjectOverride: subject,
          introHtml,
          introText,
          replaceEmDashes: true
        })
      } catch (err: unknown) {
        console.error('[weekly-digest-correction] render failed, falling back to plaintext:', err)
        if (!renderFallbackNotified) {
          renderFallbackNotified = true
          await pingOps(
            '🚨 ThreatNoir weekly digest correction render failed, sent plaintext fallback. Investigate the markdown that broke marked.'
          )
        }

        const baseRendered = renderWeeklyDigestPlaintextFallback(digestParams)
        let html = baseRendered.html
        const insert = (introHtml || '').trim()
        if (insert) {
          const closeP = html.indexOf('</p>')
          if (closeP >= 0) {
            html = html.slice(0, closeP + 4) + insert + html.slice(closeP + 4)
          } else {
            html = insert + html
          }
        }

        let text = baseRendered.text
        const introT = (introText || '').trim()
        if (introT) {
          text = `${introT}\n\n${text}`
        }

        rendered = {
          subject: subject.replace(/—/g, '-'),
          html: html.replace(/—/g, '-'),
          text: text.replace(/—/g, '-')
        }
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
        skipped += 1
        console.warn('[cron/weekly-digest-correction] send failed:', err instanceof Error ? err.message : String(err))
      }
    }
  }

  console.log(`[cron/weekly-digest-correction] done: ${sent} sent, ${skipped} skipped (total ${total}) for ${week}`)

  return { sent, skipped, week, total_subscribers: total }
})
