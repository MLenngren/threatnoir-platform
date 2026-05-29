import Anthropic from '@anthropic-ai/sdk'
import { PODCAST_PERSONAS_PROMPT } from '../data/podcast-personas'

import { logAiCall } from './aiUsage'
import { computeCostMicroCents, type AnthropicUsageLike } from './aiPricing'
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

function responseText(resp: Anthropic.Messages.Message | null | undefined): string {
  if (!resp) return ''
  return (resp.content || [])
    .map((c) => (c.type === 'text' ? (c.text || '') : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}

// Shared "Marcus voice" prompt (kept in sync with ai-gateway prompts/linkedin-voice.ts)
function buildLinkedinVoicePrompt(siteName: string): string {
  const n = (siteName || '').trim() || 'the site'
  return (
    `When drafting LinkedIn posts for the weekly ${n} roundup, match Marcus's actual posting style:\n\n` +
    '**Why:** Marcus posted the W14 roundup manually and the voice was much better than the AI-drafted numbered list. His style got engagement because it felt like a real person sharing, not a news bulletin.\n\n' +
    '**How to apply:**\n\nStructure:\n' +
    '- Open with personal commentary, not a cold hook. "I read that...", "Last week was...", a question or observation\n' +
    '- Flow as conversational paragraphs, NOT numbered lists\n' +
    '- Each story gets its own paragraph with 1-2 sentences\n' +
    '- Add parenthetical asides that show opinion: "(it does feel like Fortinet gets hit a lot?)", "(rougher than usual?)"\n' +
    '- End with the punchy tagline from the card\n' +
    '- Link at the bottom, standalone, not inline\n' +
    '- Hashtags at the very end: #cybersecurity + 1-2 topic-specific\n\nTone:\n' +
    '- Practitioner sharing with peers, not analyst briefing executives\n' +
    '- "I read that..." not "This week brought..."\n' +
    '- Personal takes: "not sure how long you would survive" not "organizations face significant risk"\n' +
    '- Slight provocations as questions, not statements\n' +
    '- No bold, no bullet points, no numbered lists\n' +
    '- No emoji\n\nReference post (W14):\n' +
    '"I read that last week was rough (rougher than usual?), if you are a business (big or small) good IT hygiene can be optional if you accept the risk, but not sure how long you would survive..."'
  )
}

export async function summarizeShowDirect(params: { title: string; script: string }): Promise<{ summary: string; costCents: number }> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null

  const system = [
    'Write a concise episode description for a security news video briefing.',
    '',
    'Output exactly TWO short sentences. Each sentence must be under 130 characters. Combined output must be under 260 characters.',
    '',
    'Sentence 1: state what happened (the incident, vulnerability, or event in one complete clause).',
    'Sentence 2: state why it matters to a security practitioner (the takeaway, consequence, or systemic issue).',
    '',
    'Output plain text only. No markdown, no quotes, no Unicode bullets, no "In today\'s episode..." or "This episode covers..." framing. Practitioner tone: neutral, factual, no hype.',
    '',
    'End each sentence with a period, exclamation mark, or question mark.'
  ].join('\n')

  const title = (params.title || '').trim()
  const script = (params.script || '').trim()
  const userPrompt = `Title: ${title}\n\nScript:\n${script.slice(0, 12000)}`

  try {
    response = await client.messages.create({
      model,
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: userPrompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'video_briefing',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { title: title.slice(0, 200) }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'video_briefing',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { title: title.slice(0, 200) }
  })

	  const usage: AnthropicUsageLike = (response?.usage ?? {}) as AnthropicUsageLike
	  const costMicroCents = computeCostMicroCents(model, usage)
  const costCents = Math.max(0, Math.round(costMicroCents / 10_000))

  return { summary: responseText(response), costCents }
}

export async function draftWeeklyRoundupDirect(params: {
  prompt: string
  week_label: string
  slug: string
}): Promise<string> {
  const client = getAnthropicClient()
  const model = 'claude-sonnet-4-20250514'
  const startedAt = Date.now()
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 6000,
      messages: [{ role: 'user', content: params.prompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'weekly_roundup',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { week_label: params.week_label, slug: params.slug }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'weekly_roundup',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { week_label: params.week_label, slug: params.slug }
  })

  return responseText(response)
}

export async function autoFocusTopicsDirect(params: {
  article_id: string
  title: string
  summary: string
  relevance_score: number
  cves: string[]
}): Promise<{ summary: string; action_required: string; severity: 'critical' | 'high' | 'medium' } | null> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

  const title = (params.title || '').trim()
  const summary = (params.summary || '').trim()
  const cves = Array.isArray(params.cves) ? params.cves.filter(Boolean).slice(0, 20) : []
  const relevance = Number(params.relevance_score ?? 0)

  const prompt = `You are a SOC team lead writing an urgent threat advisory for your blue team.

Based on this security article, write a brief focus item for threat hunters and SOC analysts.

Article title: ${title}
Summary: ${summary}
CVEs: ${cves.length ? cves.join(', ') : 'None identified'}
Relevance score: ${relevance}/10

Return ONLY valid JSON:
{
  "summary": "2-3 sentences. What happened, who is affected, what is the risk. Practitioner voice, direct, no fluff.",
  "action_required": "One clear action. e.g. 'Patch Firefox to latest version immediately' or 'Block IOCs and scan for lateral movement' or 'Monitor for exploitation of CVE-XXXX-XXXX'. Be specific.",
  "severity": "critical or high or medium"
}

Rules:
- severity: critical = active exploitation or RCE with public PoC. high = serious vuln or major breach. medium = notable but not urgent.
- action_required: must be actionable. Not 'be aware' but 'do X now'.
- No em dashes. Use periods or colons.
- Practitioner voice: direct, no corporate speak.`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
	} catch {
    await logAiCall({
      pipeline: 'focus_item',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { article_id: params.article_id, title: title.slice(0, 200) }
    })
    return null
  }

  await logAiCall({
    pipeline: 'focus_item',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: {
      article_id: params.article_id,
      title: title.slice(0, 200),
      relevance_score: params.relevance_score
    }
  })

  try {
    const text = responseText(response)
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null

    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    const summaryOut = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    const action = typeof parsed.action_required === 'string' ? parsed.action_required.trim() : ''
    const sev = typeof parsed.severity === 'string' ? parsed.severity.trim().toLowerCase() : 'high'
    if (!summaryOut || !action) return null
	    const validSev: 'critical' | 'high' | 'medium' =
	      sev === 'critical' || sev === 'high' || sev === 'medium' ? (sev as 'critical' | 'high' | 'medium') : 'high'
	    return { summary: summaryOut, action_required: action, severity: validSev }
  } catch {
    return null
  }
}

export async function draftLinkedinFocusDirect(params: {
  siteName: string
  siteUrl: string
  focus: {
    id: string
    title: string
    summary: string
    severity: string
    cve_ids?: string[]
    affected_products?: string[]
    action_required?: string
  }
}): Promise<string> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

	  const focus = params.focus
  const title = (focus.title || '').trim()
  const summary = (focus.summary || '').trim()
  const cves = Array.isArray(focus.cve_ids) ? focus.cve_ids.filter(Boolean).slice(0, 20) : []
  const affected = Array.isArray(focus.affected_products) ? focus.affected_products.filter(Boolean).slice(0, 20) : []
  const action = (focus.action_required || '').trim()

  const userPrompt =
    `Write an urgent LinkedIn post about this critical security issue. ` +
    `Title: ${title}. ` +
    `Summary: ${summary}. ` +
    `CVEs: ${cves.length ? cves.join(', ') : '(none)'}. ` +
    `Affected: ${affected.length ? affected.join(', ') : '(unknown)'}. ` +
    `Action: ${action || '(none provided)'}. ` +
    `Keep it under 150 words. Direct, first-person, practitioner sharing an alert. ` +
    `End with link to ${(params.siteUrl || '').trim()}/focus. No emoji, no bold, no lists.`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 500,
      temperature: 0.7,
      system: buildLinkedinVoicePrompt(params.siteName),
      messages: [{ role: 'user', content: userPrompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'linkedin_draft_focus',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { focus_item_id: focus.id, severity: focus.severity }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'linkedin_draft_focus',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { focus_item_id: focus.id, severity: focus.severity }
  })

  return responseText(response)
}

export async function draftLinkedinMidweekDirect(params: {
  siteName: string
  siteUrl: string
  article: { id: string; title: string; slug: string; ai_summary: string | null }
}): Promise<string> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

  const title = (params.article?.title || '').trim()
  const slug = (params.article?.slug || '').trim()
  const summary = (params.article?.ai_summary || '').trim()
  const link = `${(params.siteUrl || '').trim()}/article/${slug}`

  const userPrompt = `Write a LinkedIn insight post about this security article. Share your personal take as a practitioner — what it means, why it matters, what teams should do.

Title: ${title}
Summary: ${summary}

End with the link standalone on its own line: ${link}
Add #cybersecurity and 1-2 relevant hashtags at the very end.

Keep it 150-200 words. Conversational paragraphs, not lists.`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1000,
      temperature: 0.8,
      system: buildLinkedinVoicePrompt(params.siteName),
      messages: [{ role: 'user', content: userPrompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'linkedin_draft_midweek',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { article_id: params.article?.id, slug: params.article?.slug }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'linkedin_draft_midweek',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { article_id: params.article?.id, slug: params.article?.slug }
  })

  return responseText(response)
}

export async function findRelatedArticlesDirect(params: {
  parentTitle: string
  parentSummary: string
  childTitle: string
  childSummary: string
}): Promise<boolean> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()
  const prompt = `You are a strict classifier. Determine whether Article B is an update/follow-up on the same underlying security story as Article A.

Article A title: ${params.parentTitle}
Article A summary: ${params.parentSummary}

Article B title: ${params.childTitle}
Article B summary: ${params.childSummary}

Answer with exactly one word: YES or NO.`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'related_articles_link',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: {
        parent_title: params.parentTitle.slice(0, 160),
        child_title: params.childTitle.slice(0, 160)
      }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'related_articles_link',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: {
      parent_title: params.parentTitle.slice(0, 160),
      child_title: params.childTitle.slice(0, 160)
    }
  })

  const text = responseText(response).toUpperCase()
  return text.startsWith('YES')
}

export async function tagResourceDirect(params: {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  base64: string
}): Promise<{ title: string; description: string; category: string; tags: string[] } | null> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

  const categories = ['AI Security', 'Network Security', 'Cloud Security', 'Compliance', 'Incident Response', 'Best Practices', 'Threat Intel']
  const prompt = `Analyze this security resource image. Return JSON only, no markdown:
{
  "title": "short descriptive title for this resource",
  "description": "1-2 sentence technical summary of what this resource covers",
  "category": "one of: ${categories.join(', ')}",
  "tags": ["tag1", "tag2", "tag3"] (3-5 relevant lowercase tags)
}`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: params.mediaType, data: params.base64 }
            },
            { type: 'text', text: prompt }
          ]
        }
      ]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'resource_upload_analyze',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { file_type: params.mediaType }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'resource_upload_analyze',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { file_type: params.mediaType }
  })

  try {
    const text = responseText(response)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
    const category = typeof parsed.category === 'string' ? parsed.category.trim() : ''
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : []
    return { title, description, category, tags }
  } catch {
    return null
  }
}

export async function generateAwarenessLessonDirect(params: {
  article_id: string
  title: string
  summary: string
}): Promise<Record<string, unknown>> {
  const client = getAnthropicClient()
  const model = 'claude-sonnet-4-20250514'
  const startedAt = Date.now()

  const title = (params.title || '').trim()
  const summary = (params.summary || '').trim()
  const prompt = `You are a security awareness analyst. Given this security news article, identify:
1. The root cause category (one of: Patch Management, Access Control, Configuration Management, Security Awareness, Incident Response, Network Segmentation, Data Protection, Supply Chain, Logging & Monitoring, Regulatory Compliance, Backup & Recovery, Vulnerability Management)
2. Write a concise lesson (3-5 sentences) explaining what went wrong and why it matters
3. Write a structured "prevention" section with actionable bullet points
4. List relevant framework references (CIS Controls, NIST, ITIL, GDPR articles, etc.)

Article title: ${title}
Article summary: ${summary}

IMPORTANT — the "prevention" field must be structured with markdown-style bullet points, NOT a wall of text. Format like this:
"prevention": "**Immediate actions:**\n- Patch or upgrade affected systems to the latest version\n- Enable automated vulnerability scanning for internet-facing assets\n\n**Long-term improvements:**\n- Implement emergency patching procedures for critical infrastructure\n- Maintain an accurate inventory of all network appliances\n- Establish network segmentation around critical systems"

Each prevention should have 2-3 categories (e.g., Immediate actions, Long-term improvements, Detection measures) with 2-3 bullet points each. Keep each bullet point to ONE actionable sentence.

Respond in JSON: { "categories": ["slug1", "slug2"], "title": "short headline", "body": "lesson text", "prevention": "structured prevention with bullet points", "framework_refs": ["CIS Control 7", "NIST AC-2"] }

Allowed category slugs (use ONLY from this list):
patch-management
access-control
configuration-management
security-awareness
incident-response
network-segmentation
data-protection
supply-chain
logging-monitoring
regulatory-compliance
backup-recovery
vulnerability-management`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'awareness_lesson',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { article_id: params.article_id, title: title.slice(0, 200) }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'awareness_lesson',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { article_id: params.article_id, title: title.slice(0, 200) }
  })

  const text = responseText(response)
  const parsed = (() => {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('No JSON in response')
    return JSON.parse(m[0]) as Record<string, unknown>
  })()
  return parsed
}

export async function tweetRelevanceCheckDirect(params: { tweetText: string }): Promise<boolean> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()
  const tweetText = (params.tweetText || '').slice(0, 500)
  const prompt =
    `Is this tweet about a specific cybersecurity event, vulnerability, threat, tool release, data breach, malware campaign, or other actionable security intelligence? Not personal opinions, jokes, memes, job posts, or self-promotion.\n\n` +
    `Tweet: "${tweetText}"\n\n` +
    `Reply with ONLY "YES" or "NO".`

  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    })
	} catch {
    await logAiCall({
      pipeline: 'tweet_relevance_check',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: { tweet_len: (params.tweetText || '').length }
    })
    // On error, let through.
    return true
  }

  await logAiCall({
    pipeline: 'tweet_relevance_check',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: { tweet_len: (params.tweetText || '').length }
  })

  const text = responseText(response).trim().toUpperCase()
  return text.startsWith('YES')
}

function normalizeString(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.replace(/\r\n/g, '\n').trim()
}

function extractJsonObject(text: string): Record<string, unknown> {
  const m = (text || '').match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0]) as Record<string, unknown>
}

export async function draftSocialPostDirect(params: {
  hookText: string
  recentHooks: string[]
  hooks: string[]
  siteName: string
  siteHost: string
  articles: Array<{ id: string; title: string; summary: string | null }>
  candidateCount?: number
}): Promise<{ article_ids: string[]; text_x: string; text_linkedin: string }> {
  const client = getAnthropicClient()

  const articlesForPrompt = params.articles.slice(0, 20).map((a) => ({
    id: a.id,
    title: a.title,
    summary: (a.summary || '').slice(0, 500)
  }))

  const prompt = `You are ${params.siteName}'s social media writer. Pick the 3 most interesting and diverse stories from the provided articles and write social media posts.

Rules:
- Practitioner voice, not marketing. Direct and useful.
- No em dashes anywhere. Use periods, colons, or pipes instead.
- Each story gets a one-line summary with the "so what" angle.
- Link to ${params.siteHost} (not individual article URLs).
- Max 3-4 hashtags: #cybersecurity #threatintel and 1-2 topic-specific ones.
- Pick diverse stories. Avoid 3 of the same category.

Return ONLY valid JSON:
{
  "article_ids": ["uuid1", "uuid2", "uuid3"],
  "text_x": "<X/Twitter version, MUST be under 280 characters including link and hashtags>",
  "text_linkedin": "<LinkedIn version, longer format with bold titles and context>"
}

Hook text to use (vary from previous posts): "${params.hookText}"
Do NOT use any of these recent hooks: ${params.recentHooks.length ? params.recentHooks.map((h) => `"${h}"`).join(', ') : '(none)'}

Available hooks (pick one):
${params.hooks.map((h) => `- "${h}"`).join('\n')}

Available articles (choose exactly 3):
${JSON.stringify(articlesForPrompt, null, 2)}
`

  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()
  const resp = await client.messages.create({
    model,
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }]
  })
  await logAiCall({
    pipeline: 'social_post_generate',
    model,
    response: resp,
    durationMs: Date.now() - startedAt,
    metadata: {
      hook_text: params.hookText,
      candidate_count: Number.isFinite(params.candidateCount ?? NaN) ? (params.candidateCount as number) : params.articles.length
    }
  })

  const parsed = extractJsonObject(responseText(resp))
  const rawIds = Array.isArray(parsed.article_ids) ? parsed.article_ids : []
  const article_ids = rawIds.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)

  let text_x = normalizeString(parsed.text_x)
  const text_linkedin = normalizeString(parsed.text_linkedin)
  if (!text_x || !text_linkedin) throw new Error('Model response missing text_x or text_linkedin')

  if (text_x.length > 280) {
    const shortenPrompt = `Shorten this X post to be under 280 characters total.
Rules:
- Keep the same 3 numbered items.
- Keep the final line with "${params.siteHost}".
- Keep 2-4 hashtags.
- No em dashes.

Return ONLY valid JSON: { "text_x": "..." }

Post:
${text_x}`

    const model2 = 'claude-haiku-4-5-20251001'
    const startedAt2 = Date.now()
    const resp2 = await client.messages.create({
      model: model2,
      max_tokens: 200,
      messages: [{ role: 'user', content: shortenPrompt }]
    })
    await logAiCall({
      pipeline: 'social_post_shorten',
      model: model2,
      response: resp2,
      durationMs: Date.now() - startedAt2,
      metadata: { original_length: text_x.length }
    })
    const p2 = extractJsonObject(responseText(resp2))
    const shortened = normalizeString(p2.text_x)
    if (shortened && shortened.length <= 280) text_x = shortened
  }

  if (text_x.length > 280) {
    throw new Error(`Generated X text exceeds 280 chars (${text_x.length})`)
  }

  return {
    article_ids: article_ids.slice(0, 3),
    text_x,
    text_linkedin
  }
}

export async function extractEventsFromHtmlDirect(params: {
  prompt: string
  source_id: string
  source_name: string
}): Promise<{ text: string; costTenths: number }> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

  const resp = await client.messages.create({
    model,
    max_tokens: 4000,
    messages: [{ role: 'user', content: params.prompt }]
  })

  await logAiCall({
    pipeline: 'event_ingest',
    model,
    response: resp,
    durationMs: Date.now() - startedAt,
    metadata: {
      source_id: params.source_id,
      source_name: params.source_name
    }
  })

  const costMicro = computeCostMicroCents(model, resp.usage ?? {})
  const costTenths = Math.round(costMicro / 1000)
  return { text: responseText(resp), costTenths }
}

export async function draftLinkedinWeeklyPostDirect(params: {
  siteName: string
  userPrompt: string
  week_label: string
  weekly_id: string
}): Promise<string> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'
  const startedAt = Date.now()

  const resp = await client.messages.create({
    model,
    max_tokens: 1000,
    temperature: 0.8,
    system: buildLinkedinVoicePrompt(params.siteName),
    messages: [{ role: 'user', content: params.userPrompt }]
  })

  await logAiCall({
    pipeline: 'linkedin_draft_weekly',
    model,
    response: resp,
    durationMs: Date.now() - startedAt,
    metadata: {
      week_label: params.week_label,
      weekly_id: params.weekly_id
    }
  })

  return responseText(resp)
}
