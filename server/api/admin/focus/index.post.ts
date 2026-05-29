import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'

import {
  attachArticlesToFocusItems,
  cleanOptionalText,
  findUniqueFocusSlug,
	generateFocusSlug,
	normalizeFocusStringArray,
  normalizeUuidArray,
  VALID_FOCUS_CATEGORIES,
  VALID_FOCUS_SEVERITIES,
  VALID_FOCUS_STATUSES
} from '../../../utils/focusItems'
import { generateAndEmailFocusDraft } from '../../../utils/linkedinFocusDraft'
import { formatFocusPost, postToMastodon } from '../../../utils/mastodon'
import { formatFocusTweet, postTweet } from '../../../utils/twitter'
import { notifyAdmin } from '../../../utils/notifyAdmin'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { getSiteConfig } from '../../../utils/siteConfig'

type Body = {
  title?: unknown
  summary?: unknown
  severity?: unknown
  category?: unknown
  cve_ids?: unknown
  affected_products?: unknown
  action_required?: unknown
  article_ids?: unknown
  ioc_summary?: unknown
  source_urls?: unknown
  status?: unknown
  expires_at?: unknown
}

function cleanRequiredText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const title = cleanRequiredText(body?.title, 200)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'title is required' })

  const summary = cleanRequiredText(body?.summary, 4000)
  if (!summary) throw createError({ statusCode: 400, statusMessage: 'summary is required' })

  const severityRaw = typeof body?.severity === 'string' ? body.severity.trim().toLowerCase() : ''
  const severity = severityRaw && VALID_FOCUS_SEVERITIES.has(severityRaw) ? severityRaw : 'critical'
  if (severityRaw && !VALID_FOCUS_SEVERITIES.has(severityRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid severity' })
  }

  const categoryRaw = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : ''
  const category = categoryRaw && VALID_FOCUS_CATEGORIES.has(categoryRaw) ? categoryRaw : 'cve'
  if (categoryRaw && !VALID_FOCUS_CATEGORIES.has(categoryRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
  }

  const statusRaw = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : ''
  const status = statusRaw && VALID_FOCUS_STATUSES.has(statusRaw) ? statusRaw : 'active'
  if (statusRaw && !VALID_FOCUS_STATUSES.has(statusRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

	const cveIds = normalizeFocusStringArray(body?.cve_ids, 50, 30)
	const affectedProducts = normalizeFocusStringArray(body?.affected_products, 50, 120)
  const actionRequired = cleanOptionalText(body?.action_required, 4000)
  const articleIds = normalizeUuidArray(body?.article_ids, 50)
  const iocSummary = cleanOptionalText(body?.ioc_summary, 4000)
	const sourceUrls = normalizeFocusStringArray(body?.source_urls, 50, 600)

	const baseSlug = generateFocusSlug(title)
  const slug = await findUniqueFocusSlug(supabase, baseSlug)

  const fortyEightHoursMs = 48 * 60 * 60 * 1000
  const defaultExpiresAt = new Date(Date.now() + fortyEightHoursMs).toISOString()
  const expiresAt = typeof body?.expires_at === 'string' && body.expires_at.trim() ? body.expires_at.trim() : defaultExpiresAt

  const insertBase = {
    title,
    slug,
    summary,
    severity,
    category,
    cve_ids: cveIds,
    affected_products: affectedProducts,
    action_required: actionRequired,
    article_ids: articleIds,
    ioc_summary: iocSummary,
    source_urls: sourceUrls,
    status,
    expires_at: expiresAt
  }

  // Insert; handle race on slug uniqueness with best-effort retries.
  let inserted = await supabase.from('focus_items').insert(insertBase).select('*').single()
  if (inserted.error && (inserted.error as unknown as { code?: string }).code === '23505') {
    for (let i = 2; i <= 20; i++) {
      const nextSlug = `${baseSlug.slice(0, Math.max(0, 80 - (`-${i}`.length)))}-${i}`
      inserted = await supabase.from('focus_items').insert({ ...insertBase, slug: nextSlug }).select('*').single()
      if (!inserted.error) break
      if ((inserted.error as unknown as { code?: string }).code !== '23505') break
    }
  }

  if (inserted.error) {
    console.error('[admin/focus/index.post] DB error:', inserted.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

	const row = inserted.data as unknown as Record<string, unknown>
	const focusId = String(row?.id || '')

	// LinkedIn draft (critical + high, fire-and-forget)
	if ((severity === 'critical' || severity === 'high') && focusId) {
		generateAndEmailFocusDraft(supabase, {
			id: focusId,
			title,
			summary,
			severity,
			cve_ids: cveIds,
			affected_products: affectedProducts,
			action_required: actionRequired || undefined
		}).catch((err) => console.error('[admin/focus/index.post] LinkedIn draft failed:', err))
	}

	// Mastodon auto-post (critical only, fire-and-forget)
	if (severity === 'critical' && focusId) {
			const siteUrl = getSiteConfig().url
		postToMastodon(formatFocusPost({ title, severity, summary, siteUrl }))
			.then((res) => {
				if (!res) return null
				return supabase
					.from('focus_items')
					.update({ mastodon_posted_at: new Date().toISOString() })
					.eq('id', focusId)
					.is('mastodon_posted_at', null)
			})
			.catch((err) => console.error('[admin/focus/index.post] mastodon post failed:', err))

		// X auto-post (critical only, fire-and-forget)
		postTweet(formatFocusTweet({ title, severity, summary, siteUrl }))
			.catch((err) => console.error('[admin/focus/index.post] X post failed:', err))
	}

  await notifyAdmin('focus_item_created', { title, severity }).catch(() => {})

  let item = inserted.data as unknown as Record<string, unknown>
  try {
    const hydrated = await attachArticlesToFocusItems(supabase, [item] as unknown as Array<{ article_ids?: unknown }>)
    item = hydrated[0] as unknown as Record<string, unknown>
  } catch {
    item = { ...item, articles: [] }
  }

  setResponseStatus(event, 201)
  return { item }
})
