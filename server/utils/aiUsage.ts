import type Anthropic from '@anthropic-ai/sdk'

import { useSupabaseAdmin } from './supabase'
import { computeCostMicroCents, type AnthropicUsageLike } from './aiPricing'

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 500)
const MONTHLY_BUDGET_CENTS = Number(process.env.AI_MONTHLY_BUDGET_CENTS || 500)

type UsageSnapshot = {
  today: string
  todayCalls: number
  monthSpendTenthsCents: number
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getAiUsageSnapshot(): Promise<UsageSnapshot> {
  const supabase = useSupabaseAdmin()
  const today = todayIsoDate()

  const { data: todayUsage, error: todayError } = await supabase
    .from('api_usage')
    .select('calls, estimated_cost_cents')
    .eq('date', today)
    .maybeSingle()

  if (todayError) throw todayError

  const monthStart = today.slice(0, 7) + '-01'
  const { data: monthUsage, error: monthError } = await supabase
    .from('api_usage')
    .select('estimated_cost_cents')
    .gte('date', monthStart)

  if (monthError) throw monthError

  const monthSpendTenthsCents = (monthUsage ?? []).reduce(
    (sum: number, r: { estimated_cost_cents: number }) => sum + (r.estimated_cost_cents ?? 0),
    0
  )

  return {
    today,
    todayCalls: todayUsage?.calls ?? 0,
    monthSpendTenthsCents
  }
}

export async function checkAiQuota(): Promise<{
  allowed: boolean
  reason?: string
  todayCalls: number
  monthSpendTenthsCents: number
}> {
  if (process.env.AI_ENABLED === 'false') {
    return { allowed: false, reason: 'AI disabled via kill switch', todayCalls: 0, monthSpendTenthsCents: 0 }
  }

  const snap = await getAiUsageSnapshot()

  if (snap.todayCalls >= DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `Daily limit reached (${DAILY_LIMIT})`,
      todayCalls: snap.todayCalls,
      monthSpendTenthsCents: snap.monthSpendTenthsCents
    }
  }

  const monthlyBudgetTenths = MONTHLY_BUDGET_CENTS * 10
  if (snap.monthSpendTenthsCents >= monthlyBudgetTenths) {
    return {
      allowed: false,
      reason: `Monthly budget exceeded ($${(MONTHLY_BUDGET_CENTS / 100).toFixed(2)})`,
      todayCalls: snap.todayCalls,
      monthSpendTenthsCents: snap.monthSpendTenthsCents
    }
  }

  return { allowed: true, todayCalls: snap.todayCalls, monthSpendTenthsCents: snap.monthSpendTenthsCents }
}

export async function recordAiCall(costTenthsCents: number): Promise<void> {
  const supabase = useSupabaseAdmin()
  const today = todayIsoDate()

  const cost = Math.max(0, Math.round(costTenthsCents))

  // Preferred: atomic upsert via DB function
  const rpcRes = await supabase.rpc('increment_api_usage', { usage_date: today, cost_tenths: cost })
  if (!rpcRes.error) return

  // Fallback: read-modify-write (best-effort)
  const { data: existing, error: readErr } = await supabase
    .from('api_usage')
    .select('id, calls, estimated_cost_cents')
    .eq('date', today)
    .maybeSingle()
  if (readErr) throw readErr

  if (existing) {
    const { error: updateErr } = await supabase
      .from('api_usage')
      .update({
        calls: (existing.calls ?? 0) + 1,
        estimated_cost_cents: (existing.estimated_cost_cents ?? 0) + cost,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
    if (updateErr) throw updateErr
    return
  }

  const { error: insertErr } = await supabase.from('api_usage').insert({
    date: today,
    calls: 1,
    estimated_cost_cents: cost
  })
  if (insertErr) throw insertErr
}

type LogAiCallStatus = 'success' | 'error' | 'transient_retry'

function microCentsToTenthsCents(costMicroCents: number): number {
  // 1 tenth-cent == $0.001 == 1000 micro-cents ($1e-6)
  return Math.round(Math.max(0, costMicroCents) / 1000)
}

export async function logAiCall(params: {
  pipeline: string
  model: string
  response?: Anthropic.Messages.Message | { usage?: AnthropicUsageLike } | null
  durationMs?: number | null
  status?: LogAiCallStatus
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = useSupabaseAdmin()

  const usageRaw = (params.response as { usage?: AnthropicUsageLike } | null | undefined)?.usage
  const usage: Required<AnthropicUsageLike> = {
    input_tokens: Math.max(0, Math.round(usageRaw?.input_tokens ?? 0)),
    output_tokens: Math.max(0, Math.round(usageRaw?.output_tokens ?? 0)),
    cache_read_input_tokens: Math.max(0, Math.round(usageRaw?.cache_read_input_tokens ?? 0)),
    cache_creation_input_tokens: Math.max(0, Math.round(usageRaw?.cache_creation_input_tokens ?? 0))
  }

  const costMicroCents = computeCostMicroCents(params.model, usage)

  // 1) Insert per-call log (best-effort; never break pipeline execution)
  try {
    const { error } = await supabase.from('ai_call_log').insert({
      pipeline: params.pipeline,
      model: params.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached_input_tokens: usage.cache_read_input_tokens,
      cache_creation_tokens: usage.cache_creation_input_tokens,
      cost_micro_cents: costMicroCents,
      duration_ms: params.durationMs ?? null,
      status: params.status ?? 'success',
      metadata: params.metadata ?? null
    })
    if (error) {
      console.error('[logAiCall] failed inserting ai_call_log:', error.message)
    }
  } catch (err) {
    console.error('[logAiCall] unexpected error inserting ai_call_log:', err)
  }

  // 2) Backward compat: update daily aggregate used by quota checks (best-effort)
  try {
    await recordAiCall(microCentsToTenthsCents(costMicroCents))
  } catch (err) {
    console.error('[logAiCall] failed updating legacy api_usage:', err)
  }
}

export function aiLimits() {
  return {
    dailyLimitCalls: DAILY_LIMIT,
    monthlyBudgetCents: MONTHLY_BUDGET_CENTS
  }
}
