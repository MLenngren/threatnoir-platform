import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'

import { emailRecipients } from '../../utils/emailConfig'
import { requireAdminUser } from '../../utils/requireAdmin'
import {
  renderWelcomeDay0,
  renderWelcomeDay2,
  renderWelcomeDay5,
  renderWelcomeDay10
} from '../../utils/email/welcomeSequence'
import { getSiteConfig } from '../../utils/siteConfig'

type PreviewQuery = {
  template?: string
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<PreviewQuery>(event)

  const template = (query.template || '').trim()
  if (!template) {
    throw createError({ statusCode: 400, statusMessage: 'Missing template' })
  }

	  const base = getSiteConfig().url

  const [podRes, weeklyRes, awarenessRes] = await Promise.all([
    supabase
      .from('podcast_episodes')
      .select('title,date,created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('weekly_roundups')
      .select('week_label,slug,tldr,published_at,created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('awareness_lessons')
      .select('slug,title,body,published_at,created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(3)
  ])

  if (podRes.error) throw createError({ statusCode: 500, statusMessage: podRes.error.message })
  if (weeklyRes.error) throw createError({ statusCode: 500, statusMessage: weeklyRes.error.message })
  if (awarenessRes.error) throw createError({ statusCode: 500, statusMessage: awarenessRes.error.message })

  const latestPodcastTitle = cleanText((podRes.data?.[0] as Record<string, unknown> | undefined)?.title, 200) || null
  const wk = weeklyRes.data?.[0] as Record<string, unknown> | undefined

  const templateData = {
	  email: emailRecipients.previewFixture(),
    siteUrl: base,
    manageUrl: `${base}/subscribe`,
    unsubscribeUrl: `${base}/api/subscribe/00000000-0000-0000-0000-000000000000?token=00000000-0000-0000-0000-000000000000`,
    latestPodcastTitle,
    latestPodcastUrl: `${base}/podcast`,
    latestWeeklyLabel: cleanText(wk?.week_label, 40) || null,
    latestWeeklySlug: cleanText(wk?.slug, 80) || null,
    latestWeeklyTldr: cleanText(wk?.tldr, 600) || null,
    topAwarenessLessons: (awarenessRes.data ?? []).map((r) => {
      const rec = (r && typeof r === 'object' ? (r as Record<string, unknown>) : {})
      return {
        slug: cleanText(rec.slug, 120),
        title: cleanText(rec.title, 200),
        excerpt: cleanText(rec.body, 220)
      }
    })
  }

  const rendered =
    template === 'welcome_day_0'
      ? renderWelcomeDay0(templateData)
      : template === 'welcome_day_2'
        ? renderWelcomeDay2(templateData)
        : template === 'welcome_day_5'
          ? renderWelcomeDay5(templateData)
          : template === 'welcome_day_10'
            ? renderWelcomeDay10(templateData)
            : null

  if (!rendered) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid template' })
  }

  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return rendered.html
})
