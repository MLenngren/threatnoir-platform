import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { SummarizeShowRequest } from '../types.js'
import { summarizeShowClaude } from '../providers/claude.js'

export function mountSummarizeShow(app: Hono) {
  app.post('/summarize-show', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as SummarizeShowRequest | null
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const script = typeof body?.script === 'string' ? body.script.trim() : ''

    if (!title) return c.json({ error: 'invalid_request', message: 'title is required' }, 400)
    if (!script) return c.json({ error: 'invalid_request', message: 'script is required' }, 400)

    const result = await summarizeShowClaude({ title, script })
    return c.json(result)
  })
}
