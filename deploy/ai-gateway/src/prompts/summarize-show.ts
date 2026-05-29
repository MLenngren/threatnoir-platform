export const STABLE_SYSTEM = [
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

export function buildUserPrompt(title: string, script: string): string {
  const t = (title || '').trim()
  const s = (script || '').trim()
  return `Title: ${t}\n\nScript:\n${s.slice(0, 12000)}`
}
