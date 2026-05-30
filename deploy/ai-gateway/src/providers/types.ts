import type {
  AutoFocusTopicsRequest,
  AutoFocusTopicsResponse,
  ClassifiedSummary,
  DraftLinkedinFocusRequest,
  DraftLinkedinFocusResponse,
  DraftLinkedinMidweekRequest,
  DraftLinkedinMidweekResponse,
  DraftSocialPostRequest,
  DraftSocialPostResponse,
  DraftWeeklyRoundupRequest,
  DraftWeeklyRoundupResponse,
  ExtractIocsResponse,
  FindRelatedArticlesRequest,
  FindRelatedArticlesResponse,
  GenerateAwarenessResponse,
  SummarizeShowRequest,
  SummarizeShowResponse,
  TagResourceRequest,
  TagResourceResponse
} from '../types.js'

export interface Provider {
  classifyAndSummarize(title: string, summary: string | null, fullText: string | null): Promise<ClassifiedSummary>
  extractIocs(title: string, summary: string | null, fullText: string | null): Promise<ExtractIocsResponse>
  generateAwareness(title: string, summary: string): Promise<GenerateAwarenessResponse>
  relevanceCheck(text: string): Promise<boolean>
  draftSocialPost(params: DraftSocialPostRequest): Promise<DraftSocialPostResponse>
  summarizeShow(req: SummarizeShowRequest): Promise<SummarizeShowResponse>
  draftWeeklyRoundup(req: DraftWeeklyRoundupRequest): Promise<DraftWeeklyRoundupResponse>
  autoFocusTopics(req: AutoFocusTopicsRequest): Promise<AutoFocusTopicsResponse>
  draftLinkedinFocus(req: DraftLinkedinFocusRequest): Promise<DraftLinkedinFocusResponse>
  findRelatedArticles(req: FindRelatedArticlesRequest): Promise<FindRelatedArticlesResponse>
  draftLinkedinMidweek(req: DraftLinkedinMidweekRequest): Promise<DraftLinkedinMidweekResponse>
  tagResource(req: TagResourceRequest): Promise<TagResourceResponse>
}
