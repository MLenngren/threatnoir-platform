import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import Anthropic from '@anthropic-ai/sdk'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { resolveHttpUserAgent } from '../../utils/httpUserAgent'
import { aiLimits, checkAiQuota, logAiCall } from '../../utils/aiUsage'
import { computeCostMicroCents } from '../../utils/aiPricing'

type EventSourceRow = {
  id: string
  name: string
  url: string
  scraper_type: string
}

const VALID_CATEGORIES = new Set(['conference', 'workshop', 'webinar', 'ctf', 'meetup'])

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

function truncate(input: string, max: number) {
  const s = (input || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 3)).trim()}...`
}

function stripHtmlBoilerplate(html: string): string {
  let s = html
  // Remove script, style, svg, noscript blocks
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, '')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  // Remove HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Preserve <a href="..."> links as inline text so Haiku can see URLs
  s = s.replace(/<a\s[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
  // Remove remaining HTML tags but keep text content
  s = s.replace(/<[^>]+>/g, ' ')
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

function normalizeIsoDate(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function normalizeUrl(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!s.startsWith('http://') && !s.startsWith('https://')) return null
  try {
    // Ensure absolute URL.
    return new URL(s).toString()
  } catch {
    return null
  }
}

function cleanOptionalText(v: unknown, maxLen: number): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function normalizeCategory(v: unknown): string {
  const raw = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (raw && VALID_CATEGORIES.has(raw)) return raw
  return 'conference'
}

const VALID_AUDIENCES = new Set([
  'leadership', 'soc', 'offensive', 'iam', 'grc', 'cloud', 'appsec',
  'ot-iot', 'threat-intel', 'general', 'privacy', 'ai-security'
])

function normalizeAudience(v: unknown): string {
  const raw = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (raw && VALID_AUDIENCES.has(raw)) return raw
  return 'general'
}

const VALID_TAGS = new Set([
  'cloud', 'identity', 'network', 'endpoint', 'application', 'data', 'ot-iot',
  'ai-ml', 'supply-chain', 'ransomware', 'phishing', 'zero-trust', 'devsecops',
  'forensics', 'malware', 'threat-intelligence', 'compliance', 'privacy',
  'governance', 'risk', 'incident-response', 'red-team', 'blue-team', 'purple-team',
  'vulnerability-management', 'penetration-testing', 'cryptography',
  'physical-security', 'mobile', 'api-security'
])

function normalizeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter((t) => t && VALID_TAGS.has(t))
    .slice(0, 4)
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function findUniqueSlug(
  supabase: ReturnType<typeof useSupabaseAdmin>,
  base: string
): Promise<string> {
  const safeBase = (base || '').trim() || `event-${Date.now().toString(10)}`
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? safeBase : `${safeBase}-${i}`
    const check = await supabase.from('events').select('id').eq('slug', candidate).maybeSingle()
    if (check.error) throw check.error
    if (!check.data) return candidate
  }
  return `${safeBase}-${Date.now().toString(10)}`
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }

  const supabase = useSupabaseAdmin()

  const quota = await checkAiQuota()
  if (!quota.allowed) {
    return {
      sources_processed: 0,
      events_found: 0,
      events_inserted: 0,
      errors: [quota.reason || 'AI quota exceeded']
    }
  }

  const { dailyLimitCalls, monthlyBudgetCents } = aiLimits()
  const monthlyBudgetTenths = monthlyBudgetCents * 10
  let callsToday = quota.todayCalls
  let monthSpendTenths = quota.monthSpendTenthsCents

  const { data: sources, error: sourcesError } = await supabase
    .from('event_sources')
    .select('id,name,url,scraper_type')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (sourcesError) {
    console.error('[cron/ingest-events] DB error (sources):', sourcesError.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const sourceRows = (sources ?? []) as unknown as EventSourceRow[]
  if (sourceRows.length === 0) {
    return { sources_processed: 0, events_found: 0, events_inserted: 0, errors: [] }
  }

  const todayIso = toIsoDate(new Date())
  const cutoffEndedIso = toIsoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

  const client = new Anthropic({ apiKey })

  let sourcesProcessed = 0
  let eventsFound = 0
  let eventsInserted = 0
  const errors: string[] = []

  for (const source of sourceRows) {
    // Stop if we hit quota mid-run.
    if (callsToday >= dailyLimitCalls || monthSpendTenths >= monthlyBudgetTenths) {
      errors.push('AI quota exceeded mid-run; stopping early')
      break
    }

    sourcesProcessed += 1

	    try {
	      const resp = await fetch(source.url, {
	        headers: { 'User-Agent': resolveHttpUserAgent({ suffix: 'EventBot' }) },
        signal: AbortSignal.timeout(15_000)
      })

      if (!resp.ok) {
        throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
      }

      const html = await resp.text()
      const stripped = stripHtmlBoilerplate(html)
      const truncated = truncate(stripped, 30_000)

      const prompt = `Extract all security events and conferences from this HTML page.
Today's date is ${todayIso}.

Return ONLY valid JSON: {"events": [{
  "title": "...",
  "url": "the event's OWN official website URL (e.g. rsaconference.com), NOT the aggregator/listing page URL",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD or null",
  "location": "City, Country or Virtual",
  "is_virtual": true/false,
  "organizer": "organizing body name",
  "description": "2-4 sentence description covering what the event is about, who should attend, and what to expect. Use your knowledge of well-known events (BSides, OWASP, RSA, DEF CON, Security Fest, etc.) to write informative descriptions even if the page text is thin.",
  "category": "conference|workshop|webinar|ctf|meetup",
  "audience": "primary audience",
  "tags": ["topic1", "topic2"]
}]}

audience: Who is this event primarily for? Pick ONE. Use your knowledge of well-known events to classify correctly even if the listing text is sparse. For example: BSides = "offensive", OWASP events = "appsec", RSA = "leadership", DEF CON = "offensive", Security Fest = "offensive", Gartner Security = "leadership".
  Options: "leadership" (CISOs, VPs, board-level), "soc" (SOC analysts, blue team, detection),
  "offensive" (pentesters, red team, hackers, bug bounty), "iam" (identity, access management),
  "grc" (governance, risk, compliance, audit), "cloud" (cloud security, DevSecOps),
  "appsec" (application security, SAST/DAST), "ot-iot" (OT/ICS/IoT security),
  "threat-intel" (CTI, threat hunting), "general" (broad security audience),
  "privacy" (data protection, privacy), "ai-security" (AI/ML security)
  Only use "general" if you truly cannot determine the audience.

tags: 1-4 topic tags from: cloud, identity, network, endpoint, application, data, ot-iot,
  ai-ml, supply-chain, ransomware, phishing, zero-trust, devsecops, forensics, malware,
  threat-intelligence, compliance, privacy, governance, risk, incident-response, red-team,
  blue-team, purple-team, vulnerability-management, penetration-testing, cryptography,
  physical-security, mobile, api-security

Rules:
- Only include events that are clearly security/cybersecurity related
- Only include events with start_date today or in the future
- For the "url" field: use the event's OWN official website, not the URL of this listing/aggregator page. Look for outbound links to the event's homepage. If no outbound link exists but you know the event's official URL from your training data (e.g. securityfest.com, bsides.org, rsaconference.com), use that. If truly unknown, use null.
- Use absolute URLs, not relative paths
- If you can't determine a field, use null
- Do not invent events that aren't on the page

HTML:
${truncated}`

	      const model = 'claude-haiku-4-5-20251001'
	      const startedAt = Date.now()
	      const aiResp = await client.messages.create({
	        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })

	      await logAiCall({
	        pipeline: 'event_ingest',
	        model,
	        response: aiResp,
	        durationMs: Date.now() - startedAt,
	        metadata: {
	          source_id: source.id,
	          source_name: source.name
	        }
	      })

      const text = aiResp.content?.[0]?.type === 'text' ? aiResp.content[0].text : ''
	      // Count this call against quota for mid-run early stop.
	      const costMicro = computeCostMicroCents(model, aiResp.usage ?? {})
	      const costTenths = Math.round(costMicro / 1000)
	      callsToday += 1
	      monthSpendTenths += costTenths

      const parsed = extractJson(text) as Record<string, unknown>
      const rawEvents = Array.isArray(parsed.events) ? parsed.events : []
      eventsFound += rawEvents.length

      for (const ev of rawEvents) {
        if (!ev || typeof ev !== 'object') continue
        const r = ev as Record<string, unknown>

        const title = cleanOptionalText(r.title, 200)
        const startDate = normalizeIsoDate(r.start_date)
        const endDate = normalizeIsoDate(r.end_date)
        const url = normalizeUrl(r.url)

        if (!title || !startDate) continue

        // Skip events that clearly ended long ago.
        const endOrStart = endDate || startDate
        if (endOrStart < cutoffEndedIso) continue

        // If no end_date is provided, require start_date today or future.
        if (!endDate && startDate < todayIso) continue
        // If end_date is provided, allow ongoing events.
        if (endDate && endDate < todayIso) continue

        // Dedup: URL exact match if present.
        if (url) {
          const existingByUrl = await supabase.from('events').select('id').eq('url', url).limit(1)
          if (existingByUrl.error) throw existingByUrl.error
          if ((existingByUrl.data ?? []).length) continue
        }

        // Dedup: title (case-insensitive exact) + date.
        const existingByTitle = await supabase
          .from('events')
          .select('id,url,audience,tags')
          .ilike('title', title)
          .eq('start_date', startDate)
          .limit(1)

        if (existingByTitle.error) throw existingByTitle.error
        if ((existingByTitle.data ?? []).length) {
          // Backfill missing fields on existing events.
          const existing = existingByTitle.data[0] as Record<string, unknown>
          const patch: Record<string, unknown> = {}
          if (url && !existing.url) patch.url = url
          const audience = normalizeAudience(r.audience)
          if (audience !== 'general' && !existing.audience) patch.audience = audience
          const tags = normalizeTags(r.tags)
          const existingTags = Array.isArray(existing.tags) ? existing.tags : []
          if (tags.length > 0 && existingTags.length === 0) patch.tags = tags
          if (Object.keys(patch).length > 0) {
            await supabase.from('events').update(patch).eq('id', existing.id)
          }
          continue
        }

        const baseSlug = generateSlug(title)
        const slug = await findUniqueSlug(supabase, baseSlug)

        const payload = {
          title,
          slug,
          description: cleanOptionalText(r.description, 5000),
          url,
          start_date: startDate,
          end_date: endDate,
          location: cleanOptionalText(r.location, 200),
          is_virtual: typeof r.is_virtual === 'boolean' ? r.is_virtual : false,
          organizer: cleanOptionalText(r.organizer, 200),
          category: normalizeCategory(r.category),
          audience: normalizeAudience(r.audience),
          tags: normalizeTags(r.tags),
          status: 'approved',
          source_url: source.url,
          source_name: source.name,
          is_community_submitted: false,
          submitted_by_email: null
        }

        let insertRes = await supabase.from('events').insert(payload).select('id').single()
        if (insertRes.error && (insertRes.error as unknown as { code?: string }).code === '23505') {
          // Retry with numeric suffix.
          for (let i = 2; i <= 20; i++) {
            const nextSlug = `${baseSlug.slice(0, Math.max(0, 80 - (`-${i}`.length)))}-${i}`
            insertRes = await supabase
              .from('events')
              .insert({ ...payload, slug: nextSlug })
              .select('id')
              .single()
            if (!insertRes.error) break
            if ((insertRes.error as unknown as { code?: string }).code !== '23505') break
          }
        }

        if (insertRes.error) {
          // Unique violations on url/title should be treated as dedup (ignore), otherwise surface error.
          if ((insertRes.error as unknown as { code?: string }).code === '23505') continue
          throw insertRes.error
        }

        eventsInserted += 1
      }

      // Update last_ingested_at (best-effort).
      const { error: updateErr } = await supabase
        .from('event_sources')
        .update({ last_ingested_at: new Date().toISOString() })
        .eq('id', source.id)

      if (updateErr) {
        console.error('[cron/ingest-events] DB error (update source):', updateErr.message)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[cron/ingest-events] source error:', source.name, msg)
      errors.push(`${source.name}: ${msg}`)
      continue
    }
  }

  return {
    sources_processed: sourcesProcessed,
    events_found: eventsFound,
    events_inserted: eventsInserted,
    errors
  }
})
