import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { DraftWeeklyRoundupRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountDraftWeeklyRoundup(app: Hono) {
  app.post('/draft-weekly-roundup', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as DraftWeeklyRoundupRequest | null

    const siteName = typeof body?.siteName === 'string' ? body.siteName.trim() : ''
    const siteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl.trim() : ''
    const promptPayload = body?.promptPayload && typeof body.promptPayload === 'object' ? body.promptPayload : null

    if (!siteName) return c.json({ error: 'invalid_request', message: 'siteName is required' }, 400)
    if (!siteUrl) return c.json({ error: 'invalid_request', message: 'siteUrl is required' }, 400)
    if (!promptPayload) return c.json({ error: 'invalid_request', message: 'promptPayload is required' }, 400)

    const result = await getProvider('weekly_roundup').draftWeeklyRoundup({ siteName, siteUrl, promptPayload })
    return c.json(result)
  })
}
