import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { parseRssFeed } from '../../utils/rss'
import { safeCompare } from '../../utils/safeCompare'
import { ingestRedditSources, type RedditSource } from '../../utils/redditIngest'
import { generateArticleSlug } from '../../utils/slugify'
import { useSupabaseAdmin } from '../../utils/supabase'

const MAX_ARTICLE_AGE_HOURS = Number(process.env.MAX_ARTICLE_AGE_HOURS) || 48

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

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id,name,url,type')
    .eq('is_active', true)
	  .eq('type', 'rss')

  if (sourcesError) {
		console.error('[cron/ingest] DB error:', sourcesError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  let fetched = 0
  let created = 0
  let skipped = 0
  let stale = 0
  const errors: Array<{ source_id?: string; source_name?: string; message: string }> = []

  for (const source of sources ?? []) {
    try {
      const items = await parseRssFeed(source.url)

      // De-dupe within feed response first
      const byUrl = new Map<string, (typeof items)[number]>()
      for (const item of items) byUrl.set(item.url, item)
      const uniqueItems = [...byUrl.values()]

      // Filter out stale articles — RSS feeds can resurface old content
      const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000)
      const freshItems = uniqueItems.filter((i) => {
        if (!i.publishedAt) return true // no date = let it through
        return new Date(i.publishedAt) >= cutoff
      })
      stale += uniqueItems.length - freshItems.length

      fetched += freshItems.length

      const urls = freshItems.map((i) => i.url)
      if (urls.length === 0) continue

      const { data: existing, error: existingError } = await supabase
        .from('articles')
        .select('url')
        .in('url', urls)

	      if (existingError) {
			console.error('[cron/ingest] DB error:', existingError.message)
			throw new Error('Internal server error')
	      }

      const existingSet = new Set((existing ?? []).map((r) => (r as { url: string }).url))
      const toInsert = freshItems.filter((i) => !existingSet.has(i.url))
      skipped += freshItems.length - toInsert.length

      if (toInsert.length > 0) {
        const rows = toInsert.map((a) => ({
          title: a.title,
	          slug: generateArticleSlug(a.title, a.url),
          url: a.url,
          summary: a.summary,
          image_url: a.imageUrl,
          published_at: a.publishedAt,
          source_id: source.id,
          status: 'pending'
        }))

        // Use ignoreDuplicates as a safety net for concurrent runs.

        const { error: insertError } = await supabase
          .from('articles')
          .upsert(rows as unknown as Array<Record<string, unknown>>, { onConflict: 'url', ignoreDuplicates: true })

        if (insertError) {
					console.error('[cron/ingest] DB error:', insertError.message)
					throw new Error('Internal server error')
        }

        created += toInsert.length
      }

      await supabase
        .from('sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)

    } catch (err: unknown) {
      errors.push({
        source_id: source.id,
        source_name: source.name,

        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

	// Also ingest Reddit sources as part of the daily cron (Vercel Hobby allows only 1 schedule).
	const { data: redditSources, error: redditSourcesError } = await supabase
	  .from('sources')
	  .select('id,name,url,type')
	  .eq('is_active', true)
	  .eq('type', 'reddit')

	if (redditSourcesError) {
		console.error('[cron/ingest] DB error:', redditSourcesError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

	if ((redditSources ?? []).length > 0) {
		const redditRes = await ingestRedditSources({
			supabase,
			sources: (redditSources ?? []) as unknown as RedditSource[],
			maxArticleAgeHours: MAX_ARTICLE_AGE_HOURS,
			limitPerSubreddit: 25
		})

		fetched += redditRes.fetched
		created += redditRes.created
		skipped += redditRes.skipped
		stale += redditRes.stale
		errors.push(...redditRes.errors)
	}

	// Show episode summary backfill (best-effort). Vercel Hobby allows only 1 cron schedule.
	// Chain summarize-show from the daily ingest cron.
	let summarizeShow: unknown = null
	try {
		summarizeShow = await $fetch('/api/cron/summarize-show', {
			method: 'POST',
			headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }
		})
	} catch (err: unknown) {
		errors.push({
			source_name: 'summarize_show',
			message: err instanceof Error ? err.message : String(err)
		})
		summarizeShow = { error: err instanceof Error ? err.message : String(err) }
	}

  return {
    fetched,
    new: created,
    skipped,
    stale,
		summarize_show: summarizeShow,
    errors
  }
})

