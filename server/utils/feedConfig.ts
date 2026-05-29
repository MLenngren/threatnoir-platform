import { getSiteConfig } from './siteConfig'

export type FeedMetadata = {
  copyright: string
  language: string
  podcastItunesCategory: string
  podcastItunesExplicit: 'true' | 'false'
  podcastItunesType: string
  podcastAuthorName: string
  defaultArticleAuthor: string
}

function normalizeBooleanString(raw: string, fallback: 'true' | 'false'): 'true' | 'false' {
  const v = (raw || '').trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return 'true'
  if (v === 'false' || v === '0' || v === 'no') return 'false'
  return fallback
}

export function getFeedMetadata(now = new Date()): FeedMetadata {
  const site = getSiteConfig()
  const year = now.getFullYear()

  const language = (process.env.FEED_LANGUAGE || 'en-us').trim() || 'en-us'

  const copyrightEnv = (process.env.FEED_COPYRIGHT || '').trim()
  const copyright = copyrightEnv || `© ${year} ${site.name}`

  const podcastItunesCategory = (process.env.PODCAST_ITUNES_CATEGORY || 'Technology').trim() || 'Technology'
  const podcastItunesExplicit = normalizeBooleanString(process.env.PODCAST_ITUNES_EXPLICIT || '', 'false')
  const podcastItunesType = (process.env.PODCAST_ITUNES_TYPE || 'episodic').trim() || 'episodic'

  const podcastAuthorName = (process.env.PODCAST_AUTHOR_NAME || '').trim() || site.name
  const defaultArticleAuthor = (process.env.DEFAULT_ARTICLE_AUTHOR || '').trim() || site.name

  return {
    copyright,
    language,
    podcastItunesCategory,
    podcastItunesExplicit,
    podcastItunesType,
    podcastAuthorName,
    defaultArticleAuthor
  }
}
