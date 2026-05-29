import { Hono } from 'hono'
import { serve } from '@hono/node-server'

import { mountHealth } from './routes/health.js'
import { mountSummarizeArticle } from './routes/summarize-article.js'
import { mountExtractIocs } from './routes/extract-iocs.js'
import { mountGenerateAwareness } from './routes/generate-awareness.js'
import { mountRankArticles } from './routes/rank-articles.js'
import { mountDraftSocialPost } from './routes/draft-social-post.js'
import { mountSummarizeShow } from './routes/summarize-show.js'
import { mountDraftWeeklyRoundup } from './routes/draft-weekly-roundup.js'
import { mountAutoFocusTopics } from './routes/auto-focus-topics.js'
import { mountDraftLinkedinFocus } from './routes/draft-linkedin-focus.js'
import { mountFindRelatedArticles } from './routes/find-related-articles.js'
import { mountExtractCves } from './routes/extract-cves.js'
import { mountDraftLinkedinMidweek } from './routes/draft-linkedin-midweek.js'
import { mountTagResource } from './routes/tag-resource.js'

function requireNonEmpty(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`${name} is required`)
  return v
}

// Refuse to start with a blank token.
requireNonEmpty('AI_GATEWAY_INTERNAL_TOKEN')

const app = new Hono()

app.use('*', async (c, next) => {
  const start = Date.now()
  try {
    await next()
  } finally {
    const ms = Date.now() - start
    // Keep logs grep-friendly for verification.
    console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`)
  }
})

mountHealth(app)
mountSummarizeArticle(app)
mountExtractIocs(app)
mountGenerateAwareness(app)
mountRankArticles(app)
mountDraftSocialPost(app)
mountSummarizeShow(app)
mountDraftWeeklyRoundup(app)
mountAutoFocusTopics(app)
mountDraftLinkedinFocus(app)
mountFindRelatedArticles(app)
mountExtractCves(app)
mountDraftLinkedinMidweek(app)
mountTagResource(app)

app.onError((err, c) => {
  console.error('[ai-gateway] unhandled error:', err)
  return c.json({ error: 'internal_error' }, 500)
})

const port = Number(process.env.PORT || 8080)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
console.log(`[ai-gateway] listening on 0.0.0.0:${port}`)
