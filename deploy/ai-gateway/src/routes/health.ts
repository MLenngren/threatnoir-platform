import type { Hono } from 'hono'

export function mountHealth(app: Hono) {
  app.get('/health', (c) => c.json({ status: 'ok' }))
}
