import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { AutoFocusTopicsRequest } from '../types.js'
import { getProvider } from '../providers/index.js'

export function mountAutoFocusTopics(app: Hono) {
  app.post('/auto-focus-topics', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as AutoFocusTopicsRequest | null

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''
    const relevance_score = Number(body?.relevance_score ?? 0)
    const cves = Array.isArray(body?.cves)
      ? body!.cves.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()).slice(0, 20)
      : []

    if (!title) return c.json({ error: 'invalid_request', message: 'title is required' }, 400)
    if (!summary) return c.json({ error: 'invalid_request', message: 'summary is required' }, 400)

    const result = await getProvider('auto_focus').autoFocusTopics({ title, summary, relevance_score, cves })
    return c.json(result)
  })
}
