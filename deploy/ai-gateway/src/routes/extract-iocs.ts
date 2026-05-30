import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { ExtractIocsRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountExtractIocs(app: Hono) {
  app.post('/extract-iocs', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as ExtractIocsRequest | null

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const summary = typeof body?.summary === 'string' ? body.summary : body?.summary === null ? null : null
    const fullText = typeof body?.fullText === 'string' ? body.fullText : body?.fullText === null ? null : null

    if (!title) return c.json({ error: 'invalid_request', message: 'title is required' }, 400)

    const result = await getProvider().extractIocs(title, summary, fullText)
    return c.json(result)
  })
}
