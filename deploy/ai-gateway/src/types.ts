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
