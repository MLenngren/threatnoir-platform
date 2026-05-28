import Anthropic from '@anthropic-ai/sdk'
import { PODCAST_PERSONAS_PROMPT } from '../data/podcast-personas'

import { logAiCall } from './aiUsage'
import { cleanArticleText } from './textClean'

let anthropicClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}

const CATEGORIES = [
  { slug: 'vulnerabilities', desc: 'CVEs, patches, zero-days, security flaws' },
  { slug: 'zero-day', desc: 'Zero-day exploits and active exploitation' },
  { slug: 'breaches', desc: 'Data breaches, hacks, unauthorized access' },
  { slug: 'malware', desc: 'Malware, trojans, viruses, botnets' },
  { slug: 'ransomware', desc: 'Ransomware-specific attacks and campaigns' },
  { slug: 'supply-chain', desc: 'Supply chain attacks, dependency poisoning, build compromise' },
  { slug: 'nation-state', desc: 'State-sponsored campaigns, APT operations, cyber warfare' },
  { slug: 'incident-response', desc: 'IR playbooks, post-incident analysis, forensics' },
  { slug: 'identity-access', desc: 'IAM, MFA bypass, credential theft, authentication' },
  { slug: 'iot-ot', desc: 'IoT/OT security, industrial control systems, embedded devices' },
  { slug: 'cryptography', desc: 'Encryption, quantum threats, protocol weaknesses' },
  { slug: 'policy', desc: 'Regulations, compliance, law enforcement, government' },
  { slug: 'compliance', desc: 'GDPR, NIS2, SEC rules, regulatory frameworks' },
  { slug: 'gdpr', desc: 'EU GDPR regulation, enforcement actions, DPAs' },
  { slug: 'ccpa-cpra', desc: 'California privacy law (CCPA/CPRA) compliance and enforcement' },
  { slug: 'hipaa', desc: 'US HIPAA compliance, healthcare privacy/security regulation' },
  { slug: 'nis2', desc: 'EU NIS2 directive compliance, critical infrastructure regulation' },
  { slug: 'pci-dss', desc: 'PCI-DSS compliance, payment card data security standard' },
  { slug: 'dora', desc: 'EU DORA regulation for financial sector operational resilience' },
  { slug: 'eu-ai-act', desc: 'EU AI Act — artificial intelligence regulation and compliance' },
  { slug: 'eu-cyber-resilience-act', desc: 'EU Cyber Resilience Act (CRA) — product cybersecurity requirements' },
  { slug: 'eu-cybersecurity-act', desc: 'EU Cybersecurity Act — ENISA mandate and certification schemes' },
  { slug: 'dsa-dma', desc: 'EU Digital Services Act / Digital Markets Act' },
  { slug: 'nist', desc: 'NIST CSF, 800-series, US federal cybersecurity standards' },
  { slug: 'sec-cyber', desc: 'SEC cyber disclosure rules and enforcement' },
  { slug: 'privacy-fines', desc: 'Privacy enforcement actions, penalties, and fines' },
  { slug: 'uk-data-protection', desc: 'UK GDPR and Data Protection Act 2018' },
  { slug: 'tools', desc: 'Security tools, open source projects, new products' },
  { slug: 'open-source', desc: 'OSS vulnerabilities, package security, dependency risks' },
  { slug: 'cloud-security', desc: 'Cloud infrastructure security, CSPM, CWPP' },
  { slug: 'ai-security', desc: 'AI/ML security, LLM attacks, AI-powered threats' },
  { slug: 'threat-intelligence', desc: 'APT groups, campaigns, threat actors, IOCs' },
  { slug: 'privacy', desc: 'Data privacy, surveillance, tracking, GDPR' }
] as const

// IMPORTANT: Keep these module-level constants byte-stable across calls.
// Any per-call non-determinism in the cached prompt prefix will destroy cache hits.
const CATEGORY_LIST = CATEGORIES.map((c) => `- ${c.slug}: ${c.desc}`).join('\n')

// Stable prompt prefix for article_summarize (LEN-1825): identical for every request.
// Keep formatting and wording changes minimal to avoid any quality regressions.
const STABLE_INSTRUCTIONS = `Classify this security news article, write a summary, extract IOCs, and optionally write a podcast dialogue snippet.

Respond with ONLY valid JSON:
{
  "category": "<primary-slug>",
  "tags": ["slug-1", "slug-2"],
		  "brief": "<single sentence (max 120 chars)>",
  "summary": "<2-3 sentence summary>",
  "jurisdiction": "<country or region if regulatory article, e.g. 'EU', 'France', 'US', 'UK'. null if not regulatory>",
  "regulation": "<regulation name if regulatory article, e.g. 'GDPR', 'CCPA', 'HIPAA', 'NIS2'. null if not regulatory>",
		  "fine_amount": "<penalty amount if enforcement action, e.g. '€1.2M', '$500K'. null if not a fine>",
  "iocs": [
    {"type": "<type>", "value": "<value>", "context": "<brief context>"}
  ],
		  "entities": [
		    {"type": "product|vendor|threat_actor|campaign|technology", "name": "..."}
		  ],
  "relevance_score": <1-10>,
  "podcast_dialogue": [
    {"speaker": "alex", "text": "..."},
    {"speaker": "marcus", "text": "..."}
  ]
}

- category: the single best-fit category slug
- tags: 1-4 additional relevant category slugs (may include the primary)
		- tags: 1-4 additional relevant category slugs (may include the primary)
		- brief: Write a single sentence (max 120 characters) capturing ONLY what happened.
		  No context, impact, or recommendations. Newspaper headline as a sentence.
		  Examples: "Microsoft March 2026 Windows 11 update introduces critical sign-in regression" or
		  "Handala threat actor resurfaces on new clearnet domain"
- summary: 2-3 sentence summary based on the full article content
		- jurisdiction: If this article involves a specific country's or region's regulation, enforcement action, or compliance requirement, provide the country or region name (EU, US, UK, France, Germany, South Korea, Brazil, China, Japan, Australia, Singapore, etc.). Leave null for general security news.
		- regulation: If a specific regulation, standard, or framework is central to the article, name it. Use the canonical short name. Common examples:
		  EU: GDPR, NIS2, DORA, EU AI Act, Cyber Resilience Act, EU Cybersecurity Act, ePrivacy, DSA, DMA, EU Data Act, Data Governance Act
		  US: CCPA/CPRA, HIPAA, PCI-DSS, SOX, NIST CSF, NIST 800-53, SEC Cyber Rules, FISMA, FTC Act, CISA BOD/ED
		  UK: UK GDPR, UK Data Protection Act, UK Online Safety Act
		  International: ISO 27001, ISO 27701, LGPD (Brazil), PIPL (China), APPI (Japan), PDPA (Singapore), PIPA (South Korea), Privacy Act (Australia)
		  Leave null if not regulatory.
		- fine_amount: If this is about an enforcement action, fine, or penalty, extract the amount (e.g. "€1.2M", "$500K", "£3.7M", "₩2.1B"). Leave null if not a fine/penalty.
- relevance_score: 1-10 rating of actionable security intelligence value
  - 8-10: Clear security news (vulnerability disclosure, breach report, malware campaign, IOC dump, security advisory, tool release, CVE details)
  - 5-7: Possibly relevant (industry commentary, opinion with intel, vendor marketing with substance, general security awareness)
  - 1-4: Low value (personal anecdotes, jokes, off-topic, self-promotion, generic advice, non-security content)

IOC types: ip, domain, hash_md5, hash_sha1, hash_sha256, url, cve, mitre_attack, email, malware
Only include IOCs that are clearly threat-related (malicious IPs, C2 domains, attack hashes, CVEs, malware names).
Do NOT include victim domains, legitimate service IPs, or benign URLs.
Return empty iocs array if none found.

		entities: Extract 1-6 named entities mentioned in the article.
		- product: specific software, library, package, hardware, or service (e.g. "Axios", "BIG-IP", "Chrome", "TrueConf", "Windows 11")
		- vendor: company that makes/maintains the product (e.g. "Microsoft", "F5", "Google", "CrowdStrike")
		- threat_actor: named threat group or individual (e.g. "Lazarus Group", "APT29", "Handala", "Volt Typhoon")
		- campaign: named attack campaign or operation (e.g. "SolarWinds", "Log4Shell", "Operation Triangulation")
		- technology: broader tech category when no specific product applies (e.g. "npm", "OAuth", "Active Directory", "Kubernetes")
		Normalize names: always "Microsoft" not "MSFT", always "Google" not "Alphabet".
		Return empty array if no specific entities can be identified.

podcast_dialogue rules:
- Two hosts discussing this story for a morning security podcast
${PODCAST_PERSONAS_PROMPT}
- 3-6 SHORT lines (max 150 chars each). Keep each line to 1-2 sentences max.
- Natural conversation with reactions ("Wait, really?", "That's wild.", "Exactly.")
- Use contractions and spoken language, not formal writing
- If the article is too thin or generic for meaningful discussion, set podcast_dialogue to null

Categories (use exact slug):
${CATEGORY_LIST}`

export type ClassifiedSummary = {
  category_slug: (typeof CATEGORIES)[number]['slug']
  tags: string[]
  ai_summary: string
  brief: string
  iocs: Array<{ type: string; value: string; context?: string }>
  entities: Array<{ type: string; name: string }>
  relevance_score: number
  jurisdiction: string | null
  regulation: string | null
  fine_amount: string | null
  podcast_dialogue?: Array<{ speaker: string; text: string }>
}

const IOC_TYPES = [
  'ip',
  'domain',
  'hash_md5',
  'hash_sha1',
  'hash_sha256',
  'url',
  'cve',
  'mitre_attack',
  'email',
  'malware'
] as const

type IocType = (typeof IOC_TYPES)[number]
type IocItem = { type: IocType; value: string; context?: string }

export async function classifyAndSummarize(
  title: string,
  summary: string | null,
  fullText: string | null
): Promise<ClassifiedSummary> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/summarize-article`

    // 60s ceiling — Claude summarize calls run 5–10s in practice. Anything
    // longer means the gateway is stuck (LLM timeout, OOM, deadlock) and the
    // cron loop should fail fast rather than pin a worker.
    const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS || 60_000)
    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gateway-token': token
        },
        body: JSON.stringify({ title, summary, fullText }),
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
      throw new Error(
        `[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText)
      )
    }

    const data = (await res.json()) as ClassifiedSummary
    return data
  }

  const client = getAnthropicClient()

  const model = 'claude-haiku-4-5-20251001'

  // Variable per-call content (kept out of the cached system prompt prefix).
  const cleanedFullText = fullText ? cleanArticleText(fullText) : ''

  const startedAt = Date.now()
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
	    max_tokens: 1000,
	    system: [
	      {
	        type: 'text',
	        text: STABLE_INSTRUCTIONS,
	        // Prefer 1-hour TTL to avoid expiring mid-cron batch.
	        cache_control: { type: 'ephemeral', ttl: '1h' }
	      }
	    ],
	    messages: [
	      {
	        role: 'user',
	        content:
	          `Article title: ${title}\n` +
	          `Article excerpt: ${summary?.trim() || 'No excerpt available'}` +
	          (cleanedFullText ? `\n\nFull article text:\n${cleanedFullText}` : '') +
	          `\n\nRespond with the JSON object described in the system prompt.`
	      }
	    ]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'article_summarize',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'article_summarize',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: {
      title: title.slice(0, 200),
      hasSummary: Boolean(summary),
      hasFullText: Boolean(fullText)
    }
  })

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const parsed = JSON.parse(jsonMatch[0]) as {
    category?: string
    tags?: unknown
	  brief?: string
    summary?: string
	  jurisdiction?: unknown
	  regulation?: unknown
	  fine_amount?: unknown
    iocs?: unknown
	  entities?: unknown
    relevance_score?: unknown
    podcast_dialogue?: unknown
  }
  const validSlugs = new Set(CATEGORIES.map((c) => c.slug))
  const validIocTypes = new Set<string>(IOC_TYPES)
	const validEntityTypes = new Set(['product', 'vendor', 'threat_actor', 'campaign', 'technology'])

  const category = validSlugs.has(String(parsed.category))
    ? (parsed.category as ClassifiedSummary['category_slug'])
    : 'vulnerabilities'

  const tags = Array.isArray(parsed.tags) ? parsed.tags : []
  const normalizedTags = Array.from(
    new Set(
      tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t): t is string => !!t && validSlugs.has(t))
    )
  ).slice(0, 4)

  const aiSummary = (typeof parsed.summary === 'string' ? parsed.summary.trim() : '') || title

	const jurisdiction = typeof parsed.jurisdiction === 'string' ? parsed.jurisdiction.trim() || null : null
	const regulation = typeof parsed.regulation === 'string' ? parsed.regulation.trim() || null : null
	const fineAmount = typeof parsed.fine_amount === 'string' ? parsed.fine_amount.trim() || null : null

	const briefRaw = typeof parsed.brief === 'string' ? parsed.brief : ''
	let brief = briefRaw.replace(/\s+/g, ' ').trim()
	if (!brief) brief = title
	if (brief.length > 120) {
	  let cut = brief.slice(0, 120)
	  const lastSpace = cut.lastIndexOf(' ')
	  // Avoid overly aggressive truncation; only trim back if it meaningfully improves readability.
	  if (lastSpace >= 60) cut = cut.slice(0, lastSpace)
	  brief = cut.trim()
	}


  const rawScore =
    typeof parsed.relevance_score === 'number'
      ? parsed.relevance_score
      : Number.parseInt(String(parsed.relevance_score ?? ''), 10)
  const relevanceScore = Number.isFinite(rawScore) ? Math.round(rawScore) : NaN
  const relevance_score = relevanceScore >= 1 && relevanceScore <= 10 ? relevanceScore : 5

  const rawIocs = Array.isArray(parsed.iocs) ? parsed.iocs : []
  const normalizedIocs: IocItem[] = []
  const seen = new Set<string>()
  for (const item of rawIocs) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const typeRaw = typeof rec.type === 'string' ? rec.type.trim() : ''
    const valueRaw = typeof rec.value === 'string' ? rec.value.trim() : ''
    const contextRaw = typeof rec.context === 'string' ? rec.context.trim() : ''
    if (!typeRaw || !valueRaw) continue
    if (!validIocTypes.has(typeRaw)) continue
    const key = `${typeRaw}:${valueRaw}`
    if (seen.has(key)) continue
    seen.add(key)
    normalizedIocs.push({
      type: typeRaw as IocType,
      value: valueRaw.slice(0, 500),
      context: contextRaw ? contextRaw.slice(0, 500) : undefined
    })
    if (normalizedIocs.length >= 50) break
  }

	const rawEntities = Array.isArray(parsed.entities) ? parsed.entities : []
	const entities = rawEntities
	  .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
	  .map((e) => {
	    const type = typeof e.type === 'string' ? e.type.trim() : ''
	    const name = typeof e.name === 'string' ? e.name.trim() : ''
	    return { type, name }
	  })
	  .filter((e) => validEntityTypes.has(e.type) && e.name.length >= 2)
	  .map((e) => ({ type: e.type, name: e.name.slice(0, 100) }))
	  .slice(0, 6)

  const rawDialogue = Array.isArray(parsed.podcast_dialogue) ? parsed.podcast_dialogue : null
  let podcastDialogue: Array<{ speaker: string; text: string }> | undefined

  if (rawDialogue && rawDialogue.length >= 2) {
    const validSpeakers = new Set(['alex', 'marcus'])
    const lines: Array<{ speaker: string; text: string }> = []
    for (const line of rawDialogue) {
      if (!line || typeof line !== 'object') continue
      const rec = line as Record<string, unknown>
      const speaker = typeof rec.speaker === 'string' ? rec.speaker.trim().toLowerCase() : ''
      const text = typeof rec.text === 'string' ? rec.text.trim() : ''
      if (!validSpeakers.has(speaker) || !text) continue
      lines.push({ speaker, text: text.slice(0, 200) })
    }
    if (lines.length >= 2) {
      podcastDialogue = lines.slice(0, 8)
    }
  }

  return {
    category_slug: category,
    tags: normalizedTags,
    ai_summary: aiSummary,
	  brief,
	  jurisdiction,
	  regulation,
	  fine_amount: fineAmount,
    iocs: normalizedIocs,
	  entities,
    relevance_score,
    podcast_dialogue: podcastDialogue
  }
}

// Estimated cost for 1 Haiku call, in *tenths of a cent* (to match api_usage accounting).
// 1 == 0.1 cents == $0.001
export function estimateCallCostTenthsCents(): number {
  return 1
}
