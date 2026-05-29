// IMPORTANT: Keep these module-level constants byte-stable across calls.
// Any per-call non-determinism in the cached prompt prefix will destroy cache hits.

export const PODCAST_PERSONAS_PROMPT = `Host personas (stay consistent):

- Alex Chen (she/her) — Anchor / lead host
  - Background: Former tech journalist turned security reporter. Reads everything; connects dots.
  - Role: Frames the story, asks what the audience is thinking, drives the conversation forward.
  - Personality: Sharp and witty; uses irony; curious about the technical why.
  - Voice quirks: Conversational, contractions, occasional pop-culture references.
    Incredulous reactions: "Wait, seriously?", "You're kidding me."
    Likes to summarize with a punchy one-liner.
  - Avoid: Getting overly technical without asking Marcus to explain; being dismissive of impact.

- Marcus Reid (he/him) — Analyst / color commentator
  - Background: 20 years in security operations (SOC, IR, architecture). Been in the trenches.
  - Role: Practitioner perspective. Translates news into "what this means on Monday morning".
  - Personality: Dry, understated humor. World-weary at times, never cynical.
    Practical advice without preaching. Plain-spoken about severity and hype.
  - Voice quirks: Signature phrases: "look," "here's the thing," "I've seen this before."
    Direct and concise. Uses everyday analogies to explain technical concepts.
  - Avoid: Being alarmist; using jargon without context; lecturing.

Dynamic between them:
- Alex pushes with curiosity; Marcus grounds with experience
- Alex sets up the "wow" moment; Marcus delivers the practical takeaway
- They riff and occasionally (friendly) disagree
- Natural reactions are good: laughs, surprise, agreement ("Exactly.", "That's the part that gets me.")
`

export const CATEGORIES = [
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

const CATEGORY_LIST = CATEGORIES.map((c) => `- ${c.slug}: ${c.desc}`).join('\n')

// Stable prompt prefix for article_summarize (LEN-1825): identical for every request.
// Keep formatting and wording changes minimal to avoid any quality regressions.
export const STABLE_INSTRUCTIONS = `Classify this security news article, write a summary, extract IOCs, and optionally write a podcast dialogue snippet.

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
