import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { FindRelatedArticlesRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountFindRelatedArticles(app: Hono) {
  app.post('/find-related-articles', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as FindRelatedArticlesRequest | null
    const parentTitle = typeof body?.parentTitle === 'string' ? body.parentTitle.trim() : ''
    const parentSummary = typeof body?.parentSummary === 'string' ? body.parentSummary : ''
    const childTitle = typeof body?.childTitle === 'string' ? body.childTitle.trim() : ''
    const childSummary = typeof body?.childSummary === 'string' ? body.childSummary : ''

    if (!parentTitle) return c.json({ error: 'invalid_request', message: 'parentTitle is required' }, 400)
    if (!childTitle) return c.json({ error: 'invalid_request', message: 'childTitle is required' }, 400)

    const result = await getProvider('related_articles').findRelatedArticles({ parentTitle, parentSummary, childTitle, childSummary })
    return c.json(result)
  })
}
