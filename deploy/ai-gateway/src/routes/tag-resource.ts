import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { TagResourceRequest } from '../types.js'
import { tagResourceClaude } from '../providers/claude.js'

export function mountTagResource(app: Hono) {
  app.post('/tag-resource', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as TagResourceRequest | null
    const mediaType = body?.mediaType
    const base64 = typeof body?.base64 === 'string' ? body.base64.trim() : ''

    if (!mediaType) return c.json({ error: 'invalid_request', message: 'mediaType is required' }, 400)
    if (!base64) return c.json({ error: 'invalid_request', message: 'base64 is required' }, 400)

    const result = await tagResourceClaude({ mediaType, base64 })
    return c.json(result)
  })
}
