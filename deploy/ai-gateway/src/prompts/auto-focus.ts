export function buildAutoFocusPrompt(params: {
  title: string
  summary: string
  cves: string[]
  relevance_score: number
}): string {
  const title = (params.title || '').trim()
  const summary = (params.summary || '').trim()
  const cves = Array.isArray(params.cves) ? params.cves.filter(Boolean).slice(0, 20) : []
  const relevance = Number(params.relevance_score ?? 0)

  return `You are a SOC team lead writing an urgent threat advisory for your blue team.

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
}
