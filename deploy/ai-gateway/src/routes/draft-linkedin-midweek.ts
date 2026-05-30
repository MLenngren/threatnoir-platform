import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { DraftLinkedinMidweekRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountDraftLinkedinMidweek(app: Hono) {
  app.post('/draft-linkedin-midweek', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as DraftLinkedinMidweekRequest | null
    const siteName = typeof body?.siteName === 'string' ? body.siteName.trim() : ''
    const siteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl.trim() : ''
    const article = body?.article && typeof body.article === 'object' ? body.article : null

    if (!siteName) return c.json({ error: 'invalid_request', message: 'siteName is required' }, 400)
    if (!siteUrl) return c.json({ error: 'invalid_request', message: 'siteUrl is required' }, 400)
    if (!article) return c.json({ error: 'invalid_request', message: 'article is required' }, 400)

    const result = await getProvider().draftLinkedinMidweek({ siteName, siteUrl, article })
    return c.json(result)
  })
}
