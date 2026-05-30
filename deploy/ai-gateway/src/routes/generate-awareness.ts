import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { GenerateAwarenessRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountGenerateAwareness(app: Hono) {
  app.post('/generate-awareness', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as GenerateAwarenessRequest | null

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''

    if (!title) return c.json({ error: 'invalid_request', message: 'title is required' }, 400)

    const result = await getProvider('awareness_lesson').generateAwareness(title, summary)
    return c.json(result)
  })
}
