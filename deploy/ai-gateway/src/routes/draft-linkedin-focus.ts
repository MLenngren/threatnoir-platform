import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { DraftLinkedinFocusRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountDraftLinkedinFocus(app: Hono) {
  app.post('/draft-linkedin-focus', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as DraftLinkedinFocusRequest | null

    const siteName = typeof body?.siteName === 'string' ? body.siteName.trim() : ''
    const siteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl.trim() : ''
    const focus = body?.focus && typeof body.focus === 'object' ? body.focus : null

    if (!siteName) return c.json({ error: 'invalid_request', message: 'siteName is required' }, 400)
    if (!siteUrl) return c.json({ error: 'invalid_request', message: 'siteUrl is required' }, 400)
    if (!focus) return c.json({ error: 'invalid_request', message: 'focus is required' }, 400)

    const result = await getProvider().draftLinkedinFocus({ siteName, siteUrl, focus })
    return c.json(result)
  })
}
