import type { useSupabaseAdmin } from './supabase'
import { checkAiQuota } from './aiUsage'
import { generateAndEmailFocusDraft } from './linkedinFocusDraft'
import { formatFocusPost, postToMastodon } from './mastodon'
import { formatFocusTweet, postTweet } from './twitter'
import { getSiteConfig } from './siteConfig'
import { autoFocusTopicsDirect } from './anthropic'

type SupabaseClient = ReturnType<typeof useSupabaseAdmin>

type CandidateArticle = {
  id: string
  title: string
  ai_summary: string | null
  brief: string | null
  url: string | null
  relevance_score: number
  category_slug: string | null
  entities: Array<{ type: string; name: string }> | null
}

type ActiveFocusItem = {
  id: string
  article_ids: string[]
  created_at: string
  severity: string
}

const MAX_FOCUS_ITEMS = 3
const FOCUS_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours
const MIN_RELEVANCE = 8

// Categories that qualify for focus items
const FOCUS_CATEGORIES = new Set([
  'vulnerabilities', 'zero-day', 'breaches', 'ransomware', 'malware',
  'supply-chain', 'nation-state'
])

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function extractCves(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) ?? []
  return [...new Set(matches.map(c => c.toUpperCase()))]
}

function extractProducts(entities: Array<{ type: string; name: string }> | null): string[] {
  if (!entities) return []
  return entities
    .filter(e => e.type === 'product' || e.type === 'vendor')
    .map(e => e.name)
    .slice(0, 5)
}

function mapCategory(slug: string | null): string {
  if (!slug) return 'advisory'
  if (slug === 'vulnerabilities' || slug === 'zero-day') return 'cve'
  if (slug === 'breaches') return 'breach'
  if (slug === 'ransomware' || slug === 'malware') return 'exploit'
  if (slug === 'supply-chain') return 'campaign'
  if (slug === 'nation-state') return 'campaign'
  return 'advisory'
}

async function generateFocusSummary(
  article: CandidateArticle
): Promise<{ summary: string; action_required: string; severity: string } | null> {
  const articleText = [article.title, article.ai_summary || article.brief || ''].join('\n\n')
  const cves = extractCves(articleText)

  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/auto-focus-topics`
    const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gateway-token': token
        },
        body: JSON.stringify({
          title: article.title,
          summary: article.ai_summary || article.brief || 'No summary available',
          relevance_score: article.relevance_score,
          cves
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      throw new Error(
        `[ai-gateway] ${isTimeout ? `timeout after ${timeoutMs}ms` : 'network error'} calling ${url}: ${msg}`
      )
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
	      const e = new Error(
	        `[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText)
	      ) as Error & { status?: number }
	      e.status = res.status
	      throw e
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!data) return null
    const summary = typeof data.summary === 'string' ? data.summary.trim() : ''
    const action = typeof data.action_required === 'string' ? data.action_required.trim() : ''
    const sev = typeof data.severity === 'string' ? data.severity.trim().toLowerCase() : 'high'
    if (!summary || !action) return null
    const validSev = ['critical', 'high', 'medium'].includes(sev) ? sev : 'high'
    return { summary, action_required: action, severity: validSev }
  }

  return await autoFocusTopicsDirect({
    article_id: article.id,
    title: article.title,
    summary: article.ai_summary || article.brief || 'No summary available',
    relevance_score: article.relevance_score,
    cves
  })
}

/**
 * Auto-generate and refresh focus items from top recent articles.
 *
 * Called from the summarize cron as a post-processing step.
 * - Picks top 3 articles from last 48h with high relevance + security category
 * - Generates focus items via Haiku
 * - Replaces stale items (>48h) or swaps weakest if new item is more severe
 */
export async function refreshFocusItems(supabase: SupabaseClient): Promise<{
  created: number
  archived: number
  skipped_reason?: string
}> {
	  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
	  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
	  if (!gatewayUrl && !apiKey) return { created: 0, archived: 0, skipped_reason: 'no_api_key' }

  const quota = await checkAiQuota()
  if (!quota.allowed) return { created: 0, archived: 0, skipped_reason: 'quota' }

  const now = new Date()
  const cutoff48h = new Date(now.getTime() - FOCUS_TTL_MS).toISOString()

  // Get current active focus items
  const { data: activeItems, error: activeErr } = await supabase
    .from('focus_items')
    .select('id,article_ids,created_at,severity')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  if (activeErr) {
    console.error('[autoFocus] DB error (active):', activeErr.message)
    return { created: 0, archived: 0, skipped_reason: 'db_error' }
  }

  const active = (activeItems ?? []) as unknown as ActiveFocusItem[]

  // Check if all items are still fresh (< 48h old)
  const allFresh = active.length >= MAX_FOCUS_ITEMS &&
    active.every(item => new Date(item.created_at).getTime() > now.getTime() - FOCUS_TTL_MS)

  // Collect article IDs already in focus
  const focusedArticleIds = new Set<string>()
  for (const item of active) {
    for (const id of item.article_ids ?? []) {
      if (typeof id === 'string') focusedArticleIds.add(id)
    }
  }

  // Get candidate articles from last 48h
  const { data: rawCandidates, error: candErr } = await supabase
    .from('articles')
    .select('id,title,ai_summary,brief,url,relevance_score,entities,category_id,categories!inner(slug)')
    .eq('status', 'approved')
    .gte('relevance_score', MIN_RELEVANCE)
    .or(`published_at.gte.${cutoff48h},ingested_at.gte.${cutoff48h}`)
    .order('relevance_score', { ascending: false })
    .limit(20)

  if (candErr) {
    // Fallback: try without the join (categories might not work with !inner)
    const { data: fallbackCandidates, error: fallbackErr } = await supabase
      .from('articles')
      .select('id,title,ai_summary,brief,url,relevance_score,entities')
      .eq('status', 'approved')
      .gte('relevance_score', MIN_RELEVANCE)
      .or(`published_at.gte.${cutoff48h},ingested_at.gte.${cutoff48h}`)
      .order('relevance_score', { ascending: false })
      .limit(20)

    if (fallbackErr) {
      console.error('[autoFocus] DB error (candidates):', fallbackErr.message)
      return { created: 0, archived: 0, skipped_reason: 'db_error' }
    }

    // Use fallback without category filtering
    const candidates: CandidateArticle[] = []
    for (const row of (fallbackCandidates ?? []) as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id : ''
      if (!id || focusedArticleIds.has(id)) continue
      candidates.push({
        id,
        title: typeof r.title === 'string' ? r.title : '',
        ai_summary: typeof r.ai_summary === 'string' ? r.ai_summary : null,
        brief: typeof r.brief === 'string' ? r.brief : null,
        url: typeof r.url === 'string' ? r.url : null,
        relevance_score: Number(r.relevance_score ?? 0),
        category_slug: null,
        entities: Array.isArray(r.entities) ? r.entities as Array<{ type: string; name: string }> : null
      })
    }

    if (candidates.length === 0) {
      return { created: 0, archived: 0, skipped_reason: 'no_candidates' }
    }

    // If all current items are fresh and we have enough, skip
    if (allFresh) {
      return { created: 0, archived: 0, skipped_reason: 'all_fresh' }
    }

    return await createFocusItems(supabase, candidates, active, apiKey)
  }

  // Process candidates with category info
  const candidates: CandidateArticle[] = []
  for (const row of (rawCandidates ?? []) as unknown[]) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    if (!id || focusedArticleIds.has(id)) continue

    const cats = r.categories as Record<string, unknown> | null
    const catSlug = cats && typeof cats === 'object' ? (cats as Record<string, unknown>).slug as string : null

    candidates.push({
      id,
      title: typeof r.title === 'string' ? r.title : '',
      ai_summary: typeof r.ai_summary === 'string' ? r.ai_summary : null,
      brief: typeof r.brief === 'string' ? r.brief : null,
      url: typeof r.url === 'string' ? r.url : null,
      relevance_score: Number(r.relevance_score ?? 0),
      category_slug: catSlug,
      entities: Array.isArray(r.entities) ? r.entities as Array<{ type: string; name: string }> : null
    })
  }

  if (candidates.length === 0) {
    return { created: 0, archived: 0, skipped_reason: 'no_candidates' }
  }

  if (allFresh) {
    return { created: 0, archived: 0, skipped_reason: 'all_fresh' }
  }

  return await createFocusItems(supabase, candidates, active, apiKey)
}

async function createFocusItems(
  supabase: SupabaseClient,
  candidates: CandidateArticle[],
  active: ActiveFocusItem[],
  apiKey: string
): Promise<{ created: number; archived: number }> {
  const now = new Date()

  // Archive stale items (>48h)
  let archived = 0
  const staleIds = active
    .filter(item => new Date(item.created_at).getTime() <= now.getTime() - FOCUS_TTL_MS)
    .map(item => item.id)

  if (staleIds.length > 0) {
    const { error: archiveErr } = await supabase
      .from('focus_items')
      .update({ status: 'archived' })
      .in('id', staleIds)
    if (!archiveErr) archived = staleIds.length
  }

  // How many slots do we need to fill?
  const freshCount = active.length - staleIds.length
  const slotsToFill = Math.max(0, MAX_FOCUS_ITEMS - freshCount)

  if (slotsToFill === 0) return { created: 0, archived }

  // Pick top candidates (prefer focus-worthy categories, then by relevance)
  const sorted = [...candidates].sort((a, b) => {
    const aFocusWorthy = a.category_slug && FOCUS_CATEGORIES.has(a.category_slug) ? 1 : 0
    const bFocusWorthy = b.category_slug && FOCUS_CATEGORIES.has(b.category_slug) ? 1 : 0
    if (bFocusWorthy !== aFocusWorthy) return bFocusWorthy - aFocusWorthy
    return b.relevance_score - a.relevance_score
  })

  const toCreate = sorted.slice(0, slotsToFill)
  let created = 0

  for (const article of toCreate) {
    const generated = await generateFocusSummary(article, apiKey)
    if (!generated) continue

    const articleText = [article.title, article.ai_summary || ''].join(' ')
    const cveIds = extractCves(articleText)
    const products = extractProducts(article.entities)
    const category = mapCategory(article.category_slug)
    const slug = generateSlug(article.title)


    const inserted = await supabase
      .from('focus_items')
      .insert({
        title: article.title,
        slug: `${slug}-${Date.now().toString(36)}`,
        summary: generated.summary,
        severity: generated.severity,
        category,
        cve_ids: cveIds,
        affected_products: products,
        action_required: generated.action_required,
        article_ids: [article.id],
        source_urls: article.url ? [article.url] : [],
        status: 'active',
        expires_at: new Date(now.getTime() + FOCUS_TTL_MS).toISOString()
      })
      .select('id,title,summary,severity,cve_ids,affected_products,action_required')
      .single()

    if (inserted.error) {
      console.error('[autoFocus] insert error:', inserted.error.message)
      continue
    }

    const insertedItem = inserted.data as unknown as Record<string, unknown>
    const insertedSeverity = (insertedItem?.severity || '').toString().toLowerCase()
    const focusId = String(insertedItem?.id || '')

    // LinkedIn draft (critical + high, fire-and-forget)
    if (insertedSeverity === 'critical' || insertedSeverity === 'high') {
      generateAndEmailFocusDraft(supabase, {
        id: focusId,
        title: String(insertedItem.title || ''),
        summary: String(insertedItem.summary || ''),
        severity: insertedSeverity,
        cve_ids: Array.isArray(insertedItem.cve_ids) ? insertedItem.cve_ids as string[] : undefined,
        affected_products: Array.isArray(insertedItem.affected_products) ? insertedItem.affected_products as string[] : undefined,
        action_required: typeof insertedItem.action_required === 'string' ? insertedItem.action_required : undefined
      }).catch((err) => console.error('[autoFocus] LinkedIn draft failed:', err))
    }

    // Mastodon auto-post (critical only, fire-and-forget)
    if (focusId && insertedSeverity === 'critical') {
	      const siteUrl = getSiteConfig().url
      postToMastodon(
        formatFocusPost({
          title: String(insertedItem.title || ''),
          severity: insertedSeverity,
          summary: String(insertedItem.summary || ''),
          siteUrl
        })
      )
        .then((res) => {
          if (!res) return null
          return supabase
            .from('focus_items')
            .update({ mastodon_posted_at: new Date().toISOString() })
            .eq('id', focusId)
            .is('mastodon_posted_at', null)
        })
        .catch((err) => console.error('[autoFocus] mastodon post failed:', err))

      // X auto-post (critical only, fire-and-forget)
      postTweet(
        formatFocusTweet({
          title: String(insertedItem.title || ''),
          severity: insertedSeverity,
          summary: String(insertedItem.summary || ''),
          siteUrl
        })
      ).catch((err) => console.error('[autoFocus] X post failed:', err))
    }

    created++
  }

  return { created, archived }
}
