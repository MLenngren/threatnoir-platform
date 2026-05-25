import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url, { esmResolve: true, interopDefault: true })

const { computeCostMicroCents } = jiti('../server/utils/aiPricing.ts')

try {
  const cost = computeCostMicroCents('claude-haiku-4-5-20251001', {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0
  })

  if (cost !== 3500) {
    throw new Error(`Expected 3500 micro-cents, got ${String(cost)}`)
  }

  console.log('OK: aiPricing sanity check passed')
  process.exit(0)
} catch (err) {
  console.error('FAIL: aiPricing sanity check failed:', err)
  process.exit(1)
}
