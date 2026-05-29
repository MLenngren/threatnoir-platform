const DEFAULT_MAX_ARTICLE_CHARS = 4000

/**
 * Copy of server/utils/textClean.ts
 */
export function cleanArticleText(raw: string, maxChars: number = DEFAULT_MAX_ARTICLE_CHARS): string {
  let text = (raw ?? '').toString()

  // Normalize line endings.
  text = text.replace(/\r\n?/g, '\n')

  // Remove null bytes / odd control chars that occasionally appear in scraped content.
  text = text.replaceAll('\u0000', '')

  // Strip any remaining HTML tags.
  // This is intentionally simple: we don't try to interpret structure, just remove tags.
  text = text.replace(/<[^>]+>/g, ' ')

  // Normalize whitespace while preserving paragraph breaks.
  text = text.replace(/\u00a0/g, ' ')
  text = text.replace(/[ \t\f\v]+/g, ' ')
  text = text.replace(/ *\n */g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()

  if (maxChars > 0 && text.length > maxChars) {
    text = text.slice(0, maxChars).trim()
  }

  return text
}
