import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, defineEventHandler } from 'h3'

import { requireAdminUser } from '../../utils/requireAdmin'
import { renderWeeklyDigest } from '../../utils/email/weeklyDigest'
import { getSiteConfig } from '../../utils/siteConfig'

function getWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `Week ${weekNo}, ${d.getUTCFullYear()}`
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)

  // Use service role for data access (same as cron)
  const supabase = serverSupabaseServiceRole(event)

	  const base = getSiteConfig().url

  const now = new Date()
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

  for (const [name, res] of [
    ['weekly_roundups', weeklyRes],
    ['focus_items', focusRes],
    ['awareness_lessons', lessonRes],
    ['podcast_episodes', podRes],
    ['events', eventsRes]
  ] as const) {
    if (res.error) {
      console.error(`[admin/weekly-digest-preview] DB error (${name}):`, res.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  const weeklyRow = (weeklyRes.data ?? [])[0] as Record<string, unknown> | undefined
  const weeklySlug = cleanText(weeklyRow?.slug, 80) || null
  const weeklyTldr = cleanText(weeklyRow?.tldr, 900) || null
	const executiveSummary = cleanText(weeklyRow?.executive_summary, 6000) || null
	const tagline = cleanText(weeklyRow?.tagline, 200) || null
	const coverImageUrlRaw = typeof weeklyRow?.cover_image_url === 'string' ? weeklyRow.cover_image_url.trim() : ''
	const coverImageUrl = coverImageUrlRaw ? coverImageUrlRaw : null

  const focusItems = ((focusRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      title: cleanText(r.title, 200) || '',
      severity: cleanText(r.severity, 30) || 'medium'
    }))
    .filter((r) => Boolean(r.title))
    .slice(0, 3)

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

  const previewEmail = (user.email || '').trim() || process.env.ADMIN_EMAIL || 'admin@example.com'
  const subRes = await supabase
    .from('subscribers')
    .select('id,email,verify_token')
    .eq('email', previewEmail)
    .maybeSingle()

  if (subRes.error) {
    console.error('[admin/weekly-digest-preview] DB error (subscriber lookup):', subRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const sub = (subRes.data ?? null) as null | { id: string; email: string; verify_token: string }
  const subscriberId = (sub?.id || 'preview').trim()
  const token = (sub?.verify_token || 'preview').trim()
  const unsubscribeUrl = `${base}/api/subscribe/${encodeURIComponent(subscriberId)}?token=${encodeURIComponent(token)}`

  const rendered = renderWeeklyDigest({
    email: previewEmail,
    siteUrl: base,
    unsubscribeUrl,
    weekLabel: getWeekLabel(now),
    weeklySlug,
    weeklyTldr,
		executiveSummary: executiveSummary || undefined,
		tagline: tagline || undefined,
		coverImageUrl: coverImageUrl || undefined,
    focusItems,
    awarenessLesson,
    latestPodcast,
    upcomingEvents
  })

  return { subject: rendered.subject, html: rendered.html }
})
