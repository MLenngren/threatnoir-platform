import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { TagResourceRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountTagResource(app: Hono) {
  app.post('/tag-resource', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as TagResourceRequest | null
    const mediaType = body?.mediaType
    const base64 = typeof body?.base64 === 'string' ? body.base64.trim() : ''

    if (!mediaType) return c.json({ error: 'invalid_request', message: 'mediaType is required' }, 400)
    if (!base64) return c.json({ error: 'invalid_request', message: 'base64 is required' }, 400)

    const result = await getProvider('resource_tagger').tagResource({ mediaType, base64 })
    return c.json(result)
  })
}
