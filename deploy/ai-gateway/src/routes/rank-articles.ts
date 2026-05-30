import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { RankArticlesRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountRankArticles(app: Hono) {
  app.post('/rank-articles', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as RankArticlesRequest | null

    const text = typeof body?.text === 'string' ? body.text : ''
    if (!text.trim()) return c.json({ error: 'invalid_request', message: 'text is required' }, 400)

    const relevant = await getProvider('relevance_check').relevanceCheck(text)
    return c.json({ relevant })
  })
}
