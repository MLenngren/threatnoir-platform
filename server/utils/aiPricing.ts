// Pricing utilities for AI cost tracking (LEN-1654)
//
// Units:
// - Input prices are expressed as USD per 1,000,000 tokens (MTok).
// - Returned cost is in "micro-cents" where 1 micro-cent == $0.000001 (1e-6 dollars).
//   This is intentionally *not* 1e-6 cents; it matches the ticket spec and sanity checks.

export type AnthropicUsageLike = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type ModelPricingUsdPerMTok = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

// Verified against https://docs.anthropic.com/en/docs/about-claude/pricing
// (token rates for Claude API, global inference) on 2026-05-13.
const PRICING_USD_PER_MTOK: Record<string, ModelPricingUsdPerMTok> = {
  // Claude Haiku 4.5
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // Claude Sonnet 4
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  // Claude Opus 4
  'claude-opus-4-20250514': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 }
}

function normalizeModelKey(model: string): string | null {
  if (PRICING_USD_PER_MTOK[model]) return model

  // Be tolerant to callers passing model aliases without the date suffix.
  if (model === 'claude-haiku-4-5' || model.startsWith('claude-haiku-4-5-')) {
    return 'claude-haiku-4-5-20251001'
  }
  if (model === 'claude-sonnet-4' || model.startsWith('claude-sonnet-4-')) {
    return 'claude-sonnet-4-20250514'
  }
  // IMPORTANT: do not treat Opus 4.5/4.6/4.7 as Opus 4 (pricing differs).
  if (
    model === 'claude-opus-4' ||
    (model.startsWith('claude-opus-4-') &&
      !model.startsWith('claude-opus-4-5') &&
      !model.startsWith('claude-opus-4-6') &&
      !model.startsWith('claude-opus-4-7'))
  ) {
    return 'claude-opus-4-20250514'
  }

  return null
}

export function computeCostMicroCents(model: string, usage: AnthropicUsageLike): number {
  const key = normalizeModelKey(model)
  if (!key) return 0
  const pricing = PRICING_USD_PER_MTOK[key]

  const inputTokens = Math.max(0, Math.round(usage.input_tokens ?? 0))
  const outputTokens = Math.max(0, Math.round(usage.output_tokens ?? 0))
  const cacheReadTokens = Math.max(0, Math.round(usage.cache_read_input_tokens ?? 0))
  const cacheWriteTokens = Math.max(0, Math.round(usage.cache_creation_input_tokens ?? 0))

  // Convert directly into $1e-6 units:
  // microCents = tokens * (USD/MTok)
  const raw =
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    cacheReadTokens * pricing.cacheRead +
    cacheWriteTokens * pricing.cacheWrite

  return Math.max(0, Math.round(raw))
}
