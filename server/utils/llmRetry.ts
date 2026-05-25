export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export function isPermanentError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase()
  const status = (err as { status?: unknown })?.status
  const statusNum = typeof status === 'number' ? status : Number(status)

  if (Number.isFinite(statusNum)) {
    if (statusNum === 401 || statusNum === 403) return true
    if (statusNum === 404) return true
    if (statusNum >= 400 && statusNum < 500 && statusNum !== 429) return true
  }

  const permanentMarkers = [
    'api key',
    'unauthorized',
    'forbidden',
    'invalid model',
    'model not found',
    'content policy',
    'safety',
    'refused'
  ]
  return permanentMarkers.some((m) => msg.includes(m))
}

export function isTransientError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true

  const msg = errorMessage(err).toLowerCase()
  if (msg.startsWith('transient:') || msg.includes('transient:')) return true

  const status = (err as { status?: unknown })?.status
  const statusNum = typeof status === 'number' ? status : Number(status)

  if (Number.isFinite(statusNum)) {
    if (statusNum === 429) return true
    if (statusNum >= 500 && statusNum <= 599) return true
  }

  return [
    'timeout',
    'timed out',
    'etimedout',
    'econnreset',
    'socket hang up',
    'overloaded',
    'temporarily unavailable',
    'json'
  ].some((m) => msg.includes(m))
}

export async function retryLlmCall<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; tag?: string }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 5
  const tag = opts?.tag ?? 'llm'
  let lastErr: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (isPermanentError(err) || !isTransientError(err) || attempt >= maxAttempts) {
        throw err
      }
      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1))
      const jitterMs = Math.floor(Math.random() * 200)
      console.warn(`[${tag}] retry ${attempt}/${maxAttempts}: ${errorMessage(err)}`)
      await sleep(backoffMs + jitterMs)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(errorMessage(lastErr))
}
