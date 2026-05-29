import type { SupabaseClient } from '@supabase/supabase-js'

import { aiLimits, checkAiQuota } from './aiUsage'
import { findRelatedArticlesDirect } from './anthropic'

type ArticleRow = {
  id: string
  title: string
  url: string
  summary: string | null
  ai_summary: string | null
  ingested_at: string | null
  published_at: string | null
  status: string
  parent_article_id?: string | null
}

export type LinkRelatedOptions = {
  maxPerRun?: number
  windowHours?: number
  lookbackDays?: number
  maxCandidates?: number
  requireAiSummary?: boolean
  // Use LLM only to break ties, never as a primary matcher
  enableLlmTiebreaker?: boolean
  maxLlmCalls?: number
}

export type LinkRelatedResult = {
  scanned: number
  linked: number
  skipped: number
  errors: Array<{ id?: string; error: string }>
  llm_calls: number
}

const CVE_REGEX = /CVE-[0-9]{4}-[0-9]{4,7}/gi

const STOPWORDS = new Set(
  [
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'in',
    'into',
    'is',
    'it',
    'its',
    'of',
    'on',
    'or',
    's',
    'that',
    'the',
    'their',
    'this',
    'to',
    'was',
    'were',
    'with',
    // common security-news filler
    'security',
    'cybersecurity',
    'attack',
    'attacks',
    'breach',
    'breaches',
    'hack',
    'hacks',
    'hacker',
    'hackers',
    'malware',
    'ransomware',
    'phishing',
    'exploit',
    'exploited',
    'exploitation',
    'vulnerability',
    'vulnerabilities',
    'flaw',
    'flaws',
    'bug',
    'bugs',
    'patch',
    'patches',
    'update',
    'updates',
    'report',
    'reports',
    'new',
    'critical'
  ].map((s) => s.toLowerCase())
)

function normalizeText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim()
}

export function extractCves(text: string): Set<string> {
  const set = new Set<string>()
  const t = normalizeText(text)
  for (const m of t.matchAll(CVE_REGEX)) {
    const v = (m[0] || '').toUpperCase().trim()
    if (v) set.add(v)
  }
  return set
}

function tokenizeTitle(title: string): string[] {
  const raw = normalizeText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/-/g, ' ')

  const parts = raw
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)

  return parts.filter((p) => p.length >= 3 && !STOPWORDS.has(p))
}

function extractProductKeys(originalText: string): Set<string> {
  // Heuristic: pick proper nouns / product strings from the original casing.
  // Keep this conservative to avoid false positives.
  const s = normalizeText(originalText)
  const out = new Set<string>()

  const matches = s.match(/\b([A-Z][a-z0-9][A-Za-z0-9+._-]{1,30}|[A-Z0-9]{3,10})\b/g) || []
  for (const m of matches) {
    const v = m.trim()
    if (!v) continue
    if (/^CVE$/i.test(v)) continue
    if (/^[0-9]+$/.test(v)) continue
    const lc = v.toLowerCase()
    if (STOPWORDS.has(lc)) continue
    out.add(lc)
  }
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter += 1
  const union = a.size + b.size - inter
  return union ? inter / union : 0
}

function intersectCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n += 1
  return n
}

async function llmIsUpdate(params: {
  parentTitle: string
  parentSummary: string
  childTitle: string
  childSummary: string
}): Promise<{ decision: boolean; used: boolean }> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!gatewayUrl && !apiKey) return { decision: false, used: false }
  if (process.env.AI_ENABLED === 'false') return { decision: false, used: false }

  const quota = await checkAiQuota()
  if (!quota.allowed) return { decision: false, used: false }

  const { monthlyBudgetCents } = aiLimits()
  // A safety stop if we are already over budget (should be handled by checkAiQuota, but keep conservative)
  if (quota.monthSpendTenthsCents >= monthlyBudgetCents * 10) return { decision: false, used: false }

  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/find-related-articles`
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
          parentTitle: params.parentTitle,
          parentSummary: params.parentSummary,
          childTitle: params.childTitle,
          childSummary: params.childSummary
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
      throw new Error(`[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText))
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const decision = Boolean(data && typeof data.decision === 'boolean' ? data.decision : false)
    return { decision, used: true }
  }

  const decision = await findRelatedArticlesDirect({
    parentTitle: params.parentTitle,
    parentSummary: params.parentSummary,
    childTitle: params.childTitle,
    childSummary: params.childSummary
  })
  return { decision, used: true }
}

export async function linkRelatedArticles(
  supabase: SupabaseClient,
  options: LinkRelatedOptions = {}
): Promise<LinkRelatedResult> {
  const maxPerRun = Math.max(1, Math.min(20, options.maxPerRun ?? 20))
  const windowHours = Math.max(1, Math.min(72, options.windowHours ?? 24))
  const lookbackDays = Math.max(1, Math.min(60, options.lookbackDays ?? 14))
  const maxCandidates = Math.max(50, Math.min(1500, options.maxCandidates ?? 800))
  const requireAiSummary = options.requireAiSummary ?? false
  const enableLlmTiebreaker = options.enableLlmTiebreaker ?? true
  const maxLlmCalls = Math.max(0, Math.min(10, options.maxLlmCalls ?? 5))

  const result: LinkRelatedResult = {
    scanned: 0,
    linked: 0,
    skipped: 0,
    errors: [],
    llm_calls: 0
  }

  const cutoffIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  const lookbackIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  let q = supabase
    .from('articles')
    .select('id,title,url,summary,ai_summary,ingested_at,published_at,status,parent_article_id')
    .gte('ingested_at', cutoffIso)
    .is('parent_article_id', null)
    .in('status', ['approved', 'pending'])
    .limit(maxPerRun)
    .order('ingested_at', { ascending: true })

  if (requireAiSummary) {
    // PostgREST uses .not('col','is',null) for not-null
    q = q.not('ai_summary', 'is', null)
  }

  const { data: recentRows, error: recentErr } = await q
  if (recentErr) {
    result.errors.push({ error: `DB error (recent): ${recentErr.message}` })
    return result
  }

  const recent = (recentRows ?? []) as unknown as ArticleRow[]
  if (!recent.length) return result

  // Candidates are approved articles only (prior coverage) to reduce false positives.
  const { data: candRows, error: candErr } = await supabase
    .from('articles')
    .select('id,title,url,summary,ai_summary,ingested_at,published_at,status')
    .eq('status', 'approved')
    .gte('ingested_at', lookbackIso)
    .order('ingested_at', { ascending: true })
    .limit(maxCandidates)

  if (candErr) {
    result.errors.push({ error: `DB error (candidates): ${candErr.message}` })
    return result
  }

  const candidates = (candRows ?? []) as unknown as ArticleRow[]
  const candMeta = candidates.map((a) => {
    const text = `${a.title || ''}\n${a.ai_summary || ''}\n${a.summary || ''}`
    const cves = extractCves(text)
    const titleTokens = new Set(tokenizeTitle(a.title || ''))
    const productKeys = extractProductKeys(`${a.title || ''} ${a.ai_summary || ''}`)
    const ingestedAt = a.ingested_at ? new Date(a.ingested_at).getTime() : 0
    return { a, cves, titleTokens, productKeys, ingestedAt }
  })

  for (const child of recent) {
    result.scanned += 1
    try {
      const childText = `${child.title || ''}\n${child.ai_summary || ''}\n${child.summary || ''}`
      const childCves = extractCves(childText)
      const childTokens = new Set(tokenizeTitle(child.title || ''))
      const childProducts = extractProductKeys(`${child.title || ''} ${child.ai_summary || ''}`)
      const childIngested = child.ingested_at ? new Date(child.ingested_at).getTime() : Date.now()

      const matches: Array<{
        parent: ArticleRow
        score: number
        cveOverlap: number
        tokenJaccard: number
        productOverlap: number
        ingestedAt: number
      }> = []

      for (const c of candMeta) {
        // Only consider older articles as parents.
        if (c.ingestedAt && childIngested && c.ingestedAt >= childIngested) continue
        if (c.a.id === child.id) continue

        const cveOverlap = childCves.size ? intersectCount(childCves, c.cves) : 0
        if (cveOverlap > 0) {
          // Strong signal.
          matches.push({
            parent: c.a,
            score: 100 + cveOverlap,
            cveOverlap,
            tokenJaccard: 0,
            productOverlap: 0,
            ingestedAt: c.ingestedAt
          })
          continue
        }

        // Heuristic match (conservative): require both high title similarity and at least 1 product-key overlap
        const tokenJaccard = jaccard(childTokens, c.titleTokens)
        const productOverlap = childProducts.size ? intersectCount(childProducts, c.productKeys) : 0

        // Require meaningful token overlap to avoid generic “security breach” matches.
        const tokenOverlap = intersectCount(childTokens, c.titleTokens)

        const isHeuristicMatch = tokenJaccard >= 0.6 && tokenOverlap >= 3 && productOverlap >= 1
        if (!isHeuristicMatch) continue

        const score = tokenJaccard * 10 + tokenOverlap + productOverlap
        matches.push({
          parent: c.a,
          score,
          cveOverlap: 0,
          tokenJaccard,
          productOverlap,
          ingestedAt: c.ingestedAt
        })
      }

      if (!matches.length) {
        result.skipped += 1
        continue
      }

      // Prefer CVE-backed matches (strong signal) without LLM.
      const cveMatches = matches.filter((m) => m.cveOverlap > 0)
      const pool = cveMatches.length ? cveMatches : matches

      // Choose the oldest matching article as the parent.
      pool.sort((x, y) => (x.ingestedAt || 0) - (y.ingestedAt || 0))
      const chosen = pool[0]

      // If multiple *non-CVE* candidates match, confirm via LLM when available; otherwise skip.
      if (!cveMatches.length && matches.length > 1 && enableLlmTiebreaker) {
        if (result.llm_calls >= maxLlmCalls) {
          result.skipped += 1
          continue
        }

        const llm = await llmIsUpdate({
          parentTitle: chosen.parent.title,
          parentSummary: (chosen.parent.ai_summary || chosen.parent.summary || '').slice(0, 800),
          childTitle: child.title,
          childSummary: (child.ai_summary || child.summary || '').slice(0, 800)
        })

        if (llm.used) result.llm_calls += 1
        // If we can't call the LLM (no key/quota), or it says NO, skip to avoid false positives.
        if (!llm.used || !llm.decision) {
          result.skipped += 1
          continue
        }
      }

      // Link the child to the chosen parent (oldest match).
      const { error: updateErr } = await supabase
        .from('articles')
        .update({ parent_article_id: chosen.parent.id, relation_type: 'update' })
        .eq('id', child.id)
        .is('parent_article_id', null)

      if (updateErr) {
        throw new Error(updateErr.message)
      }

      result.linked += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push({ id: child.id, error: msg })
    }
  }

  return result
}
