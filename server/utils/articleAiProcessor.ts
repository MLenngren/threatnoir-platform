import type { SupabaseClient } from '@supabase/supabase-js'

import { classifyAndSummarize } from './anthropic'
import { scrapeArticleWithImage } from './scraper'

export type ArticleAiOptions = {
  overwriteStatus: boolean
  approveThreshold?: number
  rejectThreshold?: number
}

export type ArticleAiResult = {
  ok: boolean
  relevance_score?: number
  category_id?: string | null
  newStatus?: 'pending' | 'approved' | 'rejected'
  error?: string
}

// IOC value validation — reject non-IOC strings from AI extraction
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_RE = /^[0-9a-f:]{3,39}$/i
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i
const MD5_RE = /^[0-9a-f]{32}$/i
const SHA1_RE = /^[0-9a-f]{40}$/i
const SHA256_RE = /^[0-9a-f]{64}$/i

function validateIoc(type: string, value: unknown): boolean {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (!v || v.includes('\n')) return false

  switch (type) {
    case 'domain':
      // Must be a valid domain — no spaces, must have a dot, valid chars only
      return !v.includes(' ') && v.includes('.') && DOMAIN_RE.test(v.replace(/\[\.]/g, '.'))
    case 'ip':
      return IPV4_RE.test(v.replace(/\[\.]/g, '.')) || IPV6_RE.test(v)
    case 'hash_md5':
      return MD5_RE.test(v)
    case 'hash_sha1':
      return SHA1_RE.test(v)
    case 'hash_sha256':
      return SHA256_RE.test(v)
    case 'url':
      return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('hxxp')
    case 'email':
      return v.includes('@') && v.includes('.')
    case 'cve':
      return CVE_RE.test(v)
    case 'mitre_attack':
      return /^T\d{4}/i.test(v)
    case 'malware':
      // Malware names are freeform, just check it's not empty and reasonable length
      return v.length >= 2 && v.length <= 200
    default:
      return v.length >= 1 && v.length <= 500
  }
}

type CategoryRow = { id: string; slug: string }

let cachedCategoryLookup:
  | {
      fetchedAtMs: number
      categoryIdBySlug: Map<string, string>
      defaultCategoryId: string | null
    }
  | null = null

async function getCategoryLookup(supabase: SupabaseClient): Promise<{
  categoryIdBySlug: Map<string, string>
  defaultCategoryId: string | null
}> {
  const now = Date.now()
  // Best-effort cache — avoids N queries inside cron loops.
  if (cachedCategoryLookup && now - cachedCategoryLookup.fetchedAtMs < 5 * 60 * 1000) {
    return {
      categoryIdBySlug: cachedCategoryLookup.categoryIdBySlug,
      defaultCategoryId: cachedCategoryLookup.defaultCategoryId
    }
  }

  const { data: categories, error } = await supabase.from('categories').select('id,slug')
  if (error) throw new Error(error.message)

  const categoryIdBySlug = new Map<string, string>()
  for (const c of (categories ?? []) as unknown as CategoryRow[]) {
    if (c?.slug && c?.id) categoryIdBySlug.set(c.slug, c.id)
  }
  const defaultCategoryId = categoryIdBySlug.get('vulnerabilities') ?? null

  cachedCategoryLookup = { fetchedAtMs: now, categoryIdBySlug, defaultCategoryId }
  return { categoryIdBySlug, defaultCategoryId }
}

export async function processArticleAi(
  supabase: SupabaseClient,
  articleId: string,
  options: ArticleAiOptions
): Promise<ArticleAiResult> {
  try {
    if (process.env.AI_ENABLED === 'false') {
      return { ok: false, error: 'ai_disabled' }
    }
    // When the ai-gateway is configured, the app doesn't need an Anthropic
    // key — the gateway holds it. Only require the key on the direct path.
    if (!process.env.AI_GATEWAY_URL?.trim() && !process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: 'anthropic_key_missing' }
    }

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id,title,summary,url,published_at,image_url,status')
      .eq('id', articleId)
      .maybeSingle()

    if (articleError) {
      console.error('[processArticleAi] DB error (article):', articleError.message)
      return { ok: false, error: 'db_error' }
    }
    if (!article) return { ok: false, error: 'not_found' }

    const title = (article.title || '').trim()
    if (!title) return { ok: false, error: 'missing_title' }

    const { categoryIdBySlug, defaultCategoryId } = await getCategoryLookup(supabase)

    // Scrape full article text + OG image (null on failure — falls back to summary-only)
    let fullText: string | null = null
    let scrapedImage: string | null = null
    if (article.url) {
      try {
        const scraped = await scrapeArticleWithImage(article.url)
        fullText = scraped.text
        scrapedImage = scraped.ogImage
      } catch {
        // Scraping failure is fine — we just use summary
      }
    }

    const result = await classifyAndSummarize(title, article.summary, fullText)
    const categoryId = categoryIdBySlug.get(result.category_slug) ?? defaultCategoryId

    const patch: Record<string, unknown> = {
      ai_summary: result.ai_summary,
      brief: result.brief,

      jurisdiction: result.jurisdiction,
      regulation: result.regulation,
      fine_amount: result.fine_amount,
      entities: result.entities ?? [],

      full_text: fullText,
      image_url: scrapedImage && !article.image_url ? scrapedImage : (article.image_url || null),
      podcast_dialogue: result.relevance_score > 6 ? (result.podcast_dialogue ?? null) : null,

      category_id: categoryId,
      relevance_score: result.relevance_score
    }

    let newStatus: 'pending' | 'approved' | 'rejected' | undefined
    if (options.overwriteStatus) {
      const approveThreshold = Number.isFinite(options.approveThreshold ?? NaN) ? (options.approveThreshold as number) : 8
      const rejectThreshold = Number.isFinite(options.rejectThreshold ?? NaN) ? (options.rejectThreshold as number) : 3

      newStatus = 'pending'
      let publishedAt = article.published_at
      if (result.relevance_score >= approveThreshold) {
        newStatus = 'approved'
        publishedAt = publishedAt || new Date().toISOString()
      } else if (result.relevance_score <= rejectThreshold) {
        newStatus = 'rejected'
      }

      patch.status = newStatus
      patch.published_at = publishedAt
    }

    // IMPORTANT:
    // - For cron (overwriteStatus=true): guard status=pending so only pending items get auto-approved/rejected.
    // - For admin reprocess (overwriteStatus=false): do not guard on status.
    let updateQuery = supabase.from('articles').update(patch).eq('id', articleId)
    if (options.overwriteStatus) updateQuery = updateQuery.eq('status', 'pending')

    const { data: updatedRows, error: updateError } = await updateQuery.select('id')
    if (updateError) {
      console.error('[processArticleAi] DB error (update):', updateError.message)
      return { ok: false, error: 'db_error' }
    }
    if (!updatedRows?.length) {
      return { ok: false, error: 'no_update' }
    }

    // Replace tags
    const { error: deleteTagsError } = await supabase.from('article_tags').delete().eq('article_id', articleId)
    if (deleteTagsError) {
      console.error('[processArticleAi] DB error (delete tags):', deleteTagsError.message)
      return { ok: false, error: 'db_error' }
    }

    const tagCategoryIds = Array.from(
      new Set((result.tags ?? []).map((slug) => categoryIdBySlug.get(slug)).filter(Boolean) as string[])
    )
    if (tagCategoryIds.length) {
      const { error: insertTagsError } = await supabase.from('article_tags').insert(
        tagCategoryIds.map((cid) => ({
          article_id: articleId,
          category_id: cid
        }))
      )
      if (insertTagsError) {
        console.error('[processArticleAi] DB error (insert tags):', insertTagsError.message)
        return { ok: false, error: 'db_error' }
      }
    }

    // Replace IOCs
    const { error: deleteIocsError } = await supabase.from('article_iocs').delete().eq('article_id', articleId)
    if (deleteIocsError) {
      console.error('[processArticleAi] DB error (delete iocs):', deleteIocsError.message)
      return { ok: false, error: 'db_error' }
    }

    const iocs = Array.isArray(result.iocs) ? result.iocs : []
    const validatedIocs = iocs.filter((ioc) => validateIoc(ioc.type, ioc.value))
    if (validatedIocs.length) {
      const rows = validatedIocs.map((ioc) => ({
        article_id: articleId,
        type: ioc.type,
        value: ioc.value.trim(),
        context: ioc.context ?? null
      }))
      const { error: insertIocsError } = await supabase
        .from('article_iocs')
        .upsert(rows as unknown as Array<Record<string, unknown>>, {
          onConflict: 'article_id,type,value',
          ignoreDuplicates: true
        })
      if (insertIocsError) {
        console.error('[processArticleAi] DB error (upsert iocs):', insertIocsError.message)
        return { ok: false, error: 'db_error' }
      }
    }

    return {
      ok: true,
      relevance_score: result.relevance_score,
      category_id: categoryId,
      ...(options.overwriteStatus ? { newStatus } : {})
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[processArticleAi] unexpected error:', msg)
    return { ok: false, error: msg || 'unknown_error' }
  }
}
