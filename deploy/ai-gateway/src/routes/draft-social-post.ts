import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { DraftSocialPostRequest } from '../types.js'
import { draftSocialPostClaude } from '../providers/claude.js'

export function mountDraftSocialPost(app: Hono) {
  app.post('/draft-social-post', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as DraftSocialPostRequest | null

    const hookText = typeof body?.hookText === 'string' ? body.hookText.trim() : ''
    const siteName = typeof body?.siteName === 'string' ? body.siteName.trim() : ''
    const siteHost = typeof body?.siteHost === 'string' ? body.siteHost.trim() : ''
    const recentHooks = Array.isArray(body?.recentHooks)
      ? body!.recentHooks.filter((h): h is string => typeof h === 'string' && !!h.trim()).slice(0, 10)
      : []
    const hooks = Array.isArray(body?.hooks) ? body!.hooks.filter((h): h is string => typeof h === 'string' && !!h.trim()).slice(0, 50) : []
    const articles = Array.isArray(body?.articles) ? body!.articles : []

    if (!hookText) return c.json({ error: 'invalid_request', message: 'hookText is required' }, 400)
    if (!siteName) return c.json({ error: 'invalid_request', message: 'siteName is required' }, 400)
    if (!siteHost) return c.json({ error: 'invalid_request', message: 'siteHost is required' }, 400)
    if (hooks.length < 1) return c.json({ error: 'invalid_request', message: 'hooks is required' }, 400)
    if (articles.length < 3) return c.json({ error: 'invalid_request', message: 'articles must include at least 3 items' }, 400)

    const result = await draftSocialPostClaude({ hookText, recentHooks, hooks, siteName, siteHost, articles })
    return c.json(result)
  })
}
