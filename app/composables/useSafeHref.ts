export function safeHref(url: string | null | undefined): string {
  const input = (url ?? '').trim()
  if (!input) return '#'

  try {
    const parsed = new URL(input)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '#'
  } catch {
    return '#'
  }
}

