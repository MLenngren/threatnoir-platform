import { renderWeeklyDigest } from './email/weeklyDigest'

type RenderedEmail = { subject: string; html: string; text: string }

function insertAfterFirstMetaParagraph(html: string, insertionHtml: string): string {
  const idx = html.indexOf('<p class="meta">')
  if (idx < 0) return html
  const closeIdx = html.indexOf('</p>', idx)
  if (closeIdx < 0) return html
  const after = closeIdx + '</p>'.length
  return html.slice(0, after) + `\n` + insertionHtml + html.slice(after)
}

function insertAfterFirstLine(text: string, insertionText: string): string {
  const lines = (text || '').split('\n')
  if (lines.length === 0) return insertionText
  const [first, ...rest] = lines
  return [first, '', insertionText, '', ...rest].join('\n')
}

export function renderWeeklyDigestEmail(params: {
  digest: Parameters<typeof renderWeeklyDigest>[0]
  subjectOverride?: string
  introHtml?: string
  introText?: string
  replaceEmDashes?: boolean
}): RenderedEmail {
  const rendered = renderWeeklyDigest(params.digest)

  let subject = params.subjectOverride?.trim() || rendered.subject
  let html = rendered.html
  let text = rendered.text

  const introHtml = (params.introHtml || '').trim()
  const introText = (params.introText || '').trim()

  if (introHtml) {
    html = insertAfterFirstMetaParagraph(html, introHtml)
  }
  if (introText) {
    text = insertAfterFirstLine(text, introText)
  }

  if (params.replaceEmDashes) {
    subject = subject.replace(/—/g, '-')
    text = text.replace(/—/g, '-')
    html = html.replace(/—/g, '-')
  }

  return { subject, html, text }
}
