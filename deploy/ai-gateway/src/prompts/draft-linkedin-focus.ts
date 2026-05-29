export function buildLinkedinFocusUserPrompt(
  siteUrl: string,
  focus: {
    title?: unknown
    summary?: unknown
    cve_ids?: unknown
    affected_products?: unknown
    action_required?: unknown
  }
): string {
  const title = typeof focus?.title === 'string' ? focus.title.trim() : ''
  const summary = typeof focus?.summary === 'string' ? focus.summary.trim() : ''
  const cves = Array.isArray(focus?.cve_ids) ? (focus!.cve_ids as unknown[]).filter((x): x is string => typeof x === 'string') : []
  const affected = Array.isArray(focus?.affected_products)
    ? (focus!.affected_products as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const action = typeof focus?.action_required === 'string' ? focus.action_required.trim() : ''

  return (
    `Write an urgent LinkedIn post about this critical security issue. ` +
    `Title: ${title}. ` +
    `Summary: ${summary}. ` +
    `CVEs: ${cves.length ? cves.join(', ') : '(none)'}. ` +
    `Affected: ${affected.length ? affected.join(', ') : '(unknown)'}. ` +
    `Action: ${action || '(none provided)'}. ` +
    `Keep it under 150 words. Direct, first-person, practitioner sharing an alert. ` +
    `End with link to ${siteUrl}/focus. No emoji, no bold, no lists.`
  )
}
