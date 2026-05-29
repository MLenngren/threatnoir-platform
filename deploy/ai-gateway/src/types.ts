export type ClassifiedSummary = {
  category_slug: string
  tags: string[]
  ai_summary: string
  brief: string
  iocs: Array<{ type: string; value: string; context?: string }>
  entities: Array<{ type: string; name: string }>
  relevance_score: number
  jurisdiction: string | null
  regulation: string | null
  fine_amount: string | null
  podcast_dialogue?: Array<{ speaker: string; text: string }>
}

export type SummarizeArticleRequest = {
  title: string
  summary: string | null
  fullText: string | null
}

export type SummarizeArticleResponse = ClassifiedSummary

export type ExtractIocsRequest = SummarizeArticleRequest
export type ExtractIocsResponse = {
  iocs: ClassifiedSummary['iocs']
  entities: ClassifiedSummary['entities']
}

export type GenerateAwarenessRequest = {
  title: string
  summary: string
}

export type GenerateAwarenessResponse = {
  categories: string[]
  title: string
  body: string
  prevention: string | null
  framework_refs: string[]
}

export type RankArticlesRequest = {
  text: string
}

export type RankArticlesResponse = {
  relevant: boolean
}

export type DraftSocialPostRequest = {
  hookText: string
  recentHooks: string[]
  hooks: string[]
  siteName: string
  siteHost: string
  articles: Array<{ id: string; title: string; summary: string }>
}

export type DraftSocialPostResponse = {
  article_ids: string[]
  text_x: string
  text_linkedin: string
}
