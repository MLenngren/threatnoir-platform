export type PublicSource = {
  id: string
  name: string
  url: string
}

export type PublicCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

export type AwarenessTag = {
  // NOTE: keep awareness types in public.ts so both landing + pages can share.
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
}

export type AwarenessLesson = {
  id: string
  slug?: string
  article_id: string | null
  title: string
  body: string
  prevention: string | null
  framework_refs: string[] | null
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
  article?: { id: string; title: string; url: string } | null
  tags: AwarenessTag[]
}

export type PublicArticle = {
  id: string
  title: string
	// SEO-friendly internal URL path segment (nullable until backfill completes)
	slug?: string | null
  url: string
  summary: string | null
  ai_summary: string | null
  image_url: string | null
  relevance_score?: number
  verify_count: number
  avg_score?: number | string | null
  score_count?: number
  published_at: string | null
  ingested_at: string | null
  source?: PublicSource | null
  category?: PublicCategory | null
  tags?: Array<Pick<PublicCategory, 'id' | 'name' | 'slug'>>
  // Count of extracted IOCs (from article_iocs relation aggregate)
  ioc_count?: number
	  // Whether a published Awareness Lessons entry exists for this article
  has_awareness_lesson?: boolean
	  // If available, the published Awareness Lessons id
  awareness_lesson_id?: string | null
	// If set, this article is an update/follow-up to a previous article.
	parent_article_id?: string | null
	relation_type?: 'update' | 'follow-up' | null
	// Optional parent stub when included in API select.
	parent_article?: { id: string; title: string; url: string } | null
}

export type PublicPodcastEpisode = {
  id: string
  date: string
  title: string
  duration_seconds?: number
  audio_url: string
  article_count: number
  article_ids?: string[]
  created_at: string
}
