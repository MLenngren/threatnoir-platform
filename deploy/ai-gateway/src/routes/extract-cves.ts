import type { Hono } from 'hono'

import { requireGatewayToken } from '../auth.js'
import type { ExtractCvesRequest, ExtractCvesResponse } from '../types.js'

const CVE_REGEX = /CVE-[0-9]{4}-[0-9]{4,7}/gi

export function mountExtractCves(app: Hono) {
  app.post('/extract-cves', requireGatewayToken(), async (c) => {
    const body = (await c.req.json().catch(() => null)) as ExtractCvesRequest | null
    const text = typeof body?.text === 'string' ? body.text : ''
    if (!text) return c.json({ error: 'invalid_request', message: 'text is required' }, 400)

    const set = new Set<string>()
    for (const m of text.matchAll(CVE_REGEX)) {
      const v = (m[0] || '').toUpperCase().trim()
      if (v) set.add(v)
    }

    const res: ExtractCvesResponse = { cves: Array.from(set).slice(0, 100) }
    return c.json(res)
  })
}
