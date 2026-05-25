import Anthropic from '@anthropic-ai/sdk'

import { checkAiQuota, logAiCall } from './aiUsage'
import { retryLlmCall } from './llmRetry'
import { notifyAdmin } from './notifyAdmin'
import { isoWeekLabel, startOfIsoWeekUtc } from './isoWeek'
import { generateAndUploadWeeklyCover } from './weeklyCover'
import type { useSupabaseAdmin } from './supabase'

type SupabaseAdminClient = ReturnType<typeof useSupabaseAdmin>

type ArticleRow = {
  id: string
  title: string
  url: string
  brief: string | null
  ai_summary: string | null
  summary: string | null
  published_at: string | null
  ingested_at: string | null
  relevance_score: number | null
}

type IocRow = {
  article_id: string
  type: string
  value: string
  context: string | null
}

type AwarenessLink = { slug: string; title: string }

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

// ISO week helpers moved to server/utils/isoWeek.ts

function withinRange(iso: string | null, startIso: string, endIso: string): boolean {
  if (!iso) return false
  return iso >= startIso && iso < endIso
}

function topIocsFromRows(rows: IocRow[], limit = 15): Array<{ type: string; value: string; context?: string }> {
  const byKey = new Map<string, { type: string; value: string; context?: string; count: number }>()
  for (const r of rows) {
    const type = cleanText(r.type, 40)
    const value = cleanText(r.value, 500)
    if (!type || !value) continue
    const key = `${type}:${value}`
    const existing = byKey.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    const context = cleanText(r.context, 500)
    byKey.set(key, { type, value, context: context || undefined, count: 1 })
  }

  const sorted = [...byKey.values()].sort((a, b) => b.count - a.count)

  // Prefer diversity across IOC types.
  const out: Array<{ type: string; value: string; context?: string }> = []
  const typeCounts = new Map<string, number>()
  for (const item of sorted) {
    const tCount = typeCounts.get(item.type) ?? 0
    // Soft cap: max 4 per type.
    if (tCount >= 4) continue
    out.push({ type: item.type, value: item.value, context: item.context })
    typeCounts.set(item.type, tCount + 1)
    if (out.length >= limit) break
  }
  return out
}

export async function generateWeeklyRoundupDraft(params: {
  supabase: SupabaseAdminClient
  now?: Date
  maxArticles?: number
}): Promise<{ created: boolean; skipped_reason?: string; week_label: string; slug: string }> {
  const now = params.now ?? new Date()
  const maxArticles = Math.max(10, Math.min(120, Number(params.maxArticles ?? 80) || 80))

	const isSundayUtc = now.getUTCDay() === 0

	const currentWeekStart = startOfIsoWeekUtc(now)
	// Sunday -> summarize the week that's ending today (current ISO week).
	// Other days -> summarize the previous ISO week (existing semantics).
	const targetWeekStart = isSundayUtc
		? currentWeekStart
		: new Date(currentWeekStart.getTime() - 7 * 86400000)
	const targetWeekEndExclusive = new Date(targetWeekStart.getTime() + 7 * 86400000)
	const targetWeekEndInclusive = new Date(targetWeekEndExclusive.getTime() - 86400000)

	const weekLabel = isoWeekLabel(targetWeekStart)
	const slug = weekLabel.toLowerCase()
	const startIso = targetWeekStart.toISOString()
	const endIso = targetWeekEndExclusive.toISOString()
	const dateFrom = targetWeekStart.toISOString().slice(0, 10)
	const dateTo = targetWeekEndInclusive.toISOString().slice(0, 10)

  // Idempotency: one per week_label.
  const existingRes = await params.supabase
    .from('weekly_roundups')
    .select('id')
    .eq('week_label', weekLabel)
    .maybeSingle()
  if (existingRes.error) {
    console.error('[weeklyRoundup] DB error (existing check):', existingRes.error.message)
    throw new Error('Internal server error')
  }
  if (existingRes.data?.id) {
    return { created: false, skipped_reason: 'already_exists', week_label: weekLabel, slug }
  }

  // Quota gate.
  const quota = await checkAiQuota()
  if (!quota.allowed) {
    return { created: false, skipped_reason: quota.reason || 'ai_quota', week_label: weekLabel, slug }
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return { created: false, skipped_reason: 'anthropic_missing', week_label: weekLabel, slug }
  }

  const { data: rawArticles, error: artErr } = await params.supabase
    .from('articles')
    .select('id,title,url,brief,ai_summary,summary,published_at,ingested_at,relevance_score')
    .eq('status', 'approved')
    // Fetch a broader set then filter client-side for the window end bound.
    .or(`published_at.gte.${startIso},ingested_at.gte.${startIso}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(200)

  if (artErr) {
    console.error('[weeklyRoundup] DB error (articles):', artErr.message)
    throw new Error('Internal server error')
  }

  const articlesAll = (rawArticles ?? []) as unknown as ArticleRow[]
  const inWindow = articlesAll.filter((a) => {
    const pubOk = withinRange(a.published_at, startIso, endIso)
    const ingOk = withinRange(a.ingested_at, startIso, endIso)
    return pubOk || ingOk
  })

  const articles = inWindow
    .filter((a) => {
      // Keep low/no-score items, but prefer more relevant ones when we have enough.
      const s = Number(a.relevance_score ?? 0)
      return Number.isFinite(s) ? s >= 5 || inWindow.length < maxArticles : true
    })
    .slice(0, maxArticles)

  if (articles.length === 0) {
    return { created: false, skipped_reason: 'no_articles', week_label: weekLabel, slug }
  }

  const articleIds = articles.map((a) => a.id)

  const [{ data: iocRows, error: iocErr }, { data: awarenessRows, error: awErr }] = await Promise.all([
    params.supabase
      .from('article_iocs')
      .select('article_id,type,value,context')
      .in('article_id', articleIds)
      .limit(5000),
    params.supabase
      .from('awareness_lessons')
      .select('slug,title,article_id')
      .eq('status', 'published')
      .in('article_id', articleIds)
      .limit(5000)
  ])

  if (iocErr) {
    console.error('[weeklyRoundup] DB error (iocs):', iocErr.message)
    throw new Error('Internal server error')
  }
  if (awErr) {
    console.error('[weeklyRoundup] DB error (awareness):', awErr.message)
    throw new Error('Internal server error')
  }

  const topIocs = topIocsFromRows((iocRows ?? []) as unknown as IocRow[], 15)

  const awarenessLinks: AwarenessLink[] = []
  const seenAw = new Set<string>()
  for (const row of (awarenessRows ?? []) as unknown as Array<Record<string, unknown>>) {
    const slugRaw = typeof row.slug === 'string' ? row.slug.trim() : ''
    const titleRaw = typeof row.title === 'string' ? row.title.trim() : ''
    if (!slugRaw || !titleRaw) continue
    if (seenAw.has(slugRaw)) continue
    seenAw.add(slugRaw)
    awarenessLinks.push({ slug: slugRaw.slice(0, 120), title: titleRaw.slice(0, 200) })
    if (awarenessLinks.length >= 20) break
  }

  const promptPayload = {
    week_label: weekLabel,
    slug,
    date_from: dateFrom,
    date_to: dateTo,
    article_count: articles.length,
    instructions: {
      voice: 'practitioner, concise, no hype',
      punctuation: 'Do not use em dashes. Use hyphens or colons.',
      ioc_policy: 'Do not invent IOCs. Use only the provided top_iocs list if you mention IOCs.'
    },
    top_iocs: topIocs,
    awareness_links: awarenessLinks,
    articles: articles.map((a) => ({
      title: cleanText(a.title, 200),
      url: cleanText(a.url, 600),
      brief: cleanText(a.brief, 140) || null,
      summary: cleanText(a.ai_summary || a.summary, 1200) || null,
      published_at: a.published_at || null
    }))
  }

	  const prompt =
	    `You are ThreatNoir's weekly threat intelligence analyst. Write a comprehensive Weekly Threat Roundup for security practitioners based on the provided articles.\n\n` +
	    `Return ONLY valid JSON with this shape:\n` +
	    `{"tldr":"<5-7 bullet points, markdown list, each starts with emoji>","full_brief":"<markdown brief>","executive_summary":"<markdown executive summary>","tagline":"<tagline>","social_linkedin":"<ready-to-post>","social_x":"<ready-to-post, <= 280 chars if possible>"}\n\n` +
	    `Rules for full_brief:\n` +
	    `- Cover the TOP 8-12 most significant stories of the week. Don't compress 80 articles into 4 sections.\n` +
	    `- Organize by category: ## Vulnerabilities & Exploits, ## Ransomware & Breaches, ## Supply Chain, ## APT & Nation-State, ## Regulatory & Compliance, etc.\n` +
		    `- Each category section should have 2-4 stories. Each story is its own paragraph.\n` +
		    `- CRITICAL: Put a BLANK LINE between each story paragraph. Do not concatenate stories on the same line.\n` +
		    `- Each story paragraph: bold the headline AS A LINK to the source article URL. Then 1-2 sentences of context.\n` +
		    `- Example of correct formatting (note the blank line between stories):\n\n` +
		    `    ## Vulnerabilities & Exploits\n\n` +
		    `    **[F5 BIG-IP RCE upgraded to critical](https://source-url.com/article)**. Originally classified as DoS, now confirmed RCE with active exploitation.\n\n` +
		    `    **[Adobe Patches Reader Zero-Day](https://source-url.com/article)**. CVE-2026-34621 enables arbitrary code execution.\n\n` +
		    `    ### Key Takeaway\n` +
		    `    ...\n` +
	    `- The article URLs are provided in the articles array. Use the actual source URL for each story, not a made-up URL.\n` +
	    `- After the story bullets, add a "### Key Takeaway" under each category with 1 sentence of what practitioners should do.\n` +
	    `- If awareness lessons exist for stories, link them: [Learn more](/awareness/slug)\n` +
	    `- End with a ## References section listing 5-8 of the most important source URLs.\n` +
	    `- Target length: 800-1200 words for full_brief.\n\n` +
	    `Rules for TLDR:\n` +
	    `- 5-7 bullet points, each starting with an emoji.\n` +
	    `- Cover the week's biggest themes, not individual articles.\n\n` +
	    `Rules for social:\n` +
	    `- social_linkedin: hook + 5 bullets + "Full roundup: https://threatnoir.com/weekly/${slug}" + 3-5 hashtags. No em dashes.\n` +
	    `- social_x: punchy, under 280 chars, link to roundup.\n\n` +
	    `Rules for executive_summary and tagline:\n` +
	    `- executive_summary: VALID MARKDOWN with EXACTLY 4 sections, each introduced by an H3 header. Sections in this exact order with these exact titles:\n` +
	    `    ### The week in one line\n` +
	    `    One sentence, max 20 words. The thesis of the week. No bullets here.\n` +
	    `    ### What happened\n` +
	    `    2-3 sentences of narrative framing. Then a bullet list of 3-5 concrete events (stories, incidents, attacker moves), each one line.\n` +
	    `    ### Why it matters for defenders and leaders\n` +
	    `    2-3 sentences of narrative framing. Then a bullet list of 2-4 concrete risks or blind spots, each one line.\n` +
	    `    ### What to do this week\n` +
	    `    No prose, just a bullet list of 3-5 concrete actions. Imperative mood, concrete verbs (patch X, enable Y, review Z). Each one line.\n` +
	    `  CRITICAL MARKDOWN RULES: Use standard markdown list syntax with a hyphen and space at the start of each bullet line ("- Apache ActiveMQ..."). DO NOT use Unicode bullet characters like • or · — those break rendering. Put a BLANK LINE between the narrative prose and the bullet list within each section, and a BLANK LINE between each H3 section. Example of correct formatting:\n` +
	    `    ### What happened\n` +
	    `    Narrative sentence one. Narrative sentence two.\n` +
	    `\n` +
	    `    - First concrete event\n` +
	    `    - Second concrete event\n` +
	    `  Optimized for a CISO or practitioner who wants to scan in 20 seconds and get full value in 90. No em dashes anywhere. No hype. Every bullet must be concrete and actionable or a specific fact, never vague.\n` +
	    `- tagline: One memorable phrase, 5-10 words, captures the week's theme. Examples: "The week supply chains cracked" / "Ransomware got lazier, defenders didn't". No em dashes.\n\n` +
	    `Other rules:\n` +
	    `- If you include an IOCs section, list ONLY from top_iocs provided.\n` +
	    `- If you include an Awareness section, link using /awareness/<slug> and use ONLY provided awareness_links.\n` +
	    `- No em dashes anywhere.\n\n` +
	    JSON.stringify(promptPayload)

  const client = new Anthropic({ apiKey })

	  let lastRawText = ''
	  let result: {
	    parsed: Record<string, unknown>
	    text: string
	    tldr: string
	    fullBrief: string
	  }

	  try {
	    result = await retryLlmCall(
	      async () => {
		        const model = 'claude-sonnet-4-20250514'
		        const startedAt = Date.now()
		        const resp = await client.messages.create({
		          model,
	          max_tokens: 6000,
	          messages: [{ role: 'user', content: prompt }]
	        })

		        await logAiCall({
		          pipeline: 'weekly_roundup',
		          model,
		          response: resp,
		          durationMs: Date.now() - startedAt,
		          metadata: {
		            week_label: weekLabel,
		            slug
		          }
		        })

	        const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text : ''
	        lastRawText = text

	        let parsed: Record<string, unknown>
	        try {
	          parsed = extractJson(text) as Record<string, unknown>
	        } catch {
	          console.warn('[weeklyRoundup] JSON parse failed, raw response (truncated):', text.slice(0, 2000))
	          throw new Error('TRANSIENT: weekly roundup JSON parse failed')
	        }

	        const tldr = typeof parsed.tldr === 'string' ? parsed.tldr.trim() : ''
	        const fullBrief = typeof parsed.full_brief === 'string' ? parsed.full_brief.trim() : ''
	        if (!tldr || !fullBrief) {
	          console.warn('[weeklyRoundup] missing fields, raw response (truncated):', text.slice(0, 2000))
	          throw new Error('TRANSIENT: model response missing required fields (tldr/full_brief)')
	        }

	        return { parsed, text, tldr, fullBrief }
	      },
	      { tag: 'weeklyRoundup' }
	    )
	  } catch (err) {
	    if (lastRawText) {
	      console.error(
	        '[weeklyRoundup] all retries failed, final raw response (truncated):',
	        lastRawText.slice(0, 2000)
	      )
	    }
	    throw err
	  }

	  const parsed = result.parsed
	  const tldr = result.tldr
	  const fullBrief = result.fullBrief
	  const executiveSummaryRaw = typeof parsed.executive_summary === 'string' ? parsed.executive_summary.trim() : ''
	  const taglineRaw = typeof parsed.tagline === 'string' ? parsed.tagline.trim() : ''
	  const socialLinkedIn = typeof parsed.social_linkedin === 'string' ? parsed.social_linkedin.trim() : ''
	  const socialX = typeof parsed.social_x === 'string' ? parsed.social_x.trim() : ''

	  if (!executiveSummaryRaw) {
	    console.warn('[weeklyRoundup] Model response missing executive_summary')
	  }
	  if (!taglineRaw) {
	    console.warn('[weeklyRoundup] Model response missing tagline')
	  }

	  const executiveSummary = executiveSummaryRaw || null
	  const tagline = taglineRaw || null

	  const coverUrl = tagline ? await generateAndUploadWeeklyCover(slug, tagline, weekLabel) : null

  const insert = await params.supabase
    .from('weekly_roundups')
    .insert({
      week_label: weekLabel,
      slug,
      date_from: dateFrom,
      date_to: dateTo,
			  tldr,
			  full_brief: fullBrief,
			  executive_summary: executiveSummary,
			  tagline,
			  cover_image_url: coverUrl,
      top_iocs: topIocs as unknown,
      social_linkedin: socialLinkedIn || null,
      social_x: socialX || null,
      article_count: articles.length,
      awareness_links: awarenessLinks as unknown,
	      status: isSundayUtc ? 'published' : 'draft',
	      published_at: isSundayUtc ? now.toISOString() : null
    })
    .select('id')
    .single()

  if (insert.error) {
    console.error('[weeklyRoundup] DB error (insert):', insert.error.message)
    throw new Error('Internal server error')
  }

  // Notify admin (best-effort, non-blocking).
  await notifyAdmin('weekly_roundup_ready', {
    week_label: weekLabel,
    slug,
    url: `https://threatnoir.com/admin/weekly?week=${encodeURIComponent(weekLabel)}`
  })

  return { created: true, week_label: weekLabel, slug }
}
