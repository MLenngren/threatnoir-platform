import type { FindRelatedArticlesRequest } from '../types.js'

export function buildFindRelatedPrompt(params: FindRelatedArticlesRequest): string {
  return `You are a strict classifier. Determine whether Article B is an update/follow-up on the same underlying security story as Article A.

Article A title: ${params.parentTitle}
Article A summary: ${params.parentSummary}

Article B title: ${params.childTitle}
Article B summary: ${params.childSummary}

Answer with exactly one word: YES or NO.`
}
