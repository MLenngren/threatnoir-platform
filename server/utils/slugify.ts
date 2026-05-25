import { createHash } from 'crypto'

export function generateSlug(title: string): string {
  const base = (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return base || 'article'
}

export function addSlugSuffix(slug: string, suffix: string): string {
  return `${slug}-${suffix}`.slice(0, 90)
}

// For new articles, ensure uniqueness by suffixing a short, deterministic URL hash.
export function generateArticleSlug(title: string, url: string): string {
  const urlHash = createHash('sha256').update(url || '').digest('hex').slice(0, 6)
  return addSlugSuffix(generateSlug(title), urlHash)
}
