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

export type SummarizeShowRequest = {
  title: string
  script: string
}

export type SummarizeShowResponse = {
  summary: string
  costCents: number
}

export type DraftWeeklyRoundupRequest = {
  siteName: string
  siteUrl: string
  promptPayload: Record<string, unknown>
}

export type DraftWeeklyRoundupResponse = {
  tldr: string
  full_brief: string
  executive_summary: string | null
  tagline: string | null
  social_linkedin: string | null
  social_x: string | null
}

export type AutoFocusTopicsRequest = {
  title: string
  summary: string
  relevance_score: number
  cves: string[]
}

export type AutoFocusTopicsResponse = {
  summary: string
  action_required: string
  severity: 'critical' | 'high' | 'medium'
} | null

export type DraftLinkedinFocusRequest = {
  siteName: string
  siteUrl: string
  focus: {
    id: string
    title: string
    summary: string
    severity: string
    cve_ids?: string[]
    affected_products?: string[]
    action_required?: string
  }
}

export type DraftLinkedinFocusResponse = {
  text: string
}

export type FindRelatedArticlesRequest = {
  parentTitle: string
  parentSummary: string
  childTitle: string
  childSummary: string
}

export type FindRelatedArticlesResponse = {
  decision: boolean
}

export type ExtractCvesRequest = {
  text: string
}

export type ExtractCvesResponse = {
  cves: string[]
}

export type DraftLinkedinMidweekRequest = {
  siteName: string
  siteUrl: string
  article: {
    id: string
    title: string
    slug: string
    ai_summary: string | null
  }
}

export type DraftLinkedinMidweekResponse = {
  text: string
}

export type TagResourceRequest = {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  base64: string
}

export type TagResourceResponse = {
  title: string
  description: string
  category: string
  tags: string[]
}
