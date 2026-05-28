import type { MiddlewareHandler } from 'hono'

export function requireGatewayToken(): MiddlewareHandler {
  const expected = process.env.AI_GATEWAY_INTERNAL_TOKEN
  if (!expected || !expected.trim()) {
    throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set (gateway refuses to start without it)')
  }

  return async (c, next) => {
    const provided = c.req.header('x-gateway-token')
    if (!provided || provided !== expected) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    await next()
  }
}
