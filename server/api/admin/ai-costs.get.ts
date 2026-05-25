import { createError, defineEventHandler } from 'h3'

import { requireAdminUser } from '../../utils/requireAdmin'

type AiCallRow = {
  created_at: string
  pipeline: string
  model: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number
  cache_creation_tokens: number
  cost_micro_cents: number
  duration_ms: number | null
  status: string
}

function isoDay(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return 'invalid'
  }
}

function dollarsFromMicroCents(costMicroCents: number): number {
  return Number(((costMicroCents || 0) / 1_000_000).toFixed(6))
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)

  const now = new Date()
  const nowIso = now.toISOString()

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const chartStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const from = new Date(Math.min(monthStart.getTime(), chartStart.getTime()))
  const fromIso = from.toISOString()

  // Fetch all rows from the earliest required range (paginate to avoid implicit limits).
  // pageSize MUST match Supabase's PostgREST max_rows (default 1000) — asking for
  // a larger range gets silently capped and the chunk.length < pageSize check
  // would break on the first page, returning only the oldest 1000 rows in window.
  const pageSize = 1000
  const maxPages = 1000
  const rows: AiCallRow[] = []

  for (let page = 0; page < maxPages; page++) {
    const start = page * pageSize
    const end = start + pageSize - 1

    const { data, error } = await supabase
      .from('ai_call_log')
      .select(
        'created_at,pipeline,model,input_tokens,output_tokens,cached_input_tokens,cache_creation_tokens,cost_micro_cents,duration_ms,status'
      )
      .gte('created_at', fromIso)
      .lte('created_at', nowIso)
      .order('created_at', { ascending: true })
      .range(start, end)

    if (error) {
      console.error('[admin/ai-costs.get] DB error:', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const chunk = (data ?? []) as unknown as AiCallRow[]
    rows.push(...chunk)
    if (chunk.length < pageSize) break
  }

  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStartMs = monthStart.getTime()
  const chartStartMs = chartStart.getTime()

  let todayMicro = 0
  let weekMicro = 0
  let monthMicro = 0

  const byPipelineDailyMap = new Map<string, { date: string; pipeline: string; costMicro: number; calls: number }>()
  const byPipeline7d = new Map<string, { pipeline: string; costMicro: number; calls: number }>()
  const byModel7d = new Map<string, { model: string; costMicro: number; calls: number }>()

  let cacheRead7d = 0
  let inputTotal7d = 0

  for (const r of rows) {
    const t = new Date(r.created_at).getTime()
    const costMicro = Number(r.cost_micro_cents ?? 0) || 0

    if (t >= todayStart.getTime()) todayMicro += costMicro
    if (t >= weekStart.getTime()) weekMicro += costMicro
    if (t >= monthStartMs) monthMicro += costMicro

    if (t >= chartStartMs) {
      const date = isoDay(r.created_at)
      const pipeline = String(r.pipeline || '').trim() || '(unknown)'
      const key = `${date}::${pipeline}`
      const existing = byPipelineDailyMap.get(key)
      if (existing) {
        existing.costMicro += costMicro
        existing.calls += 1
      } else {
        byPipelineDailyMap.set(key, { date, pipeline, costMicro, calls: 1 })
      }
    }

    if (t >= weekStart.getTime()) {
      const pipeline = String(r.pipeline || '').trim() || '(unknown)'
      const model = String(r.model || '').trim() || '(unknown)'

      const p = byPipeline7d.get(pipeline) ?? { pipeline, costMicro: 0, calls: 0 }
      p.costMicro += costMicro
      p.calls += 1
      byPipeline7d.set(pipeline, p)

      const m = byModel7d.get(model) ?? { model, costMicro: 0, calls: 0 }
      m.costMicro += costMicro
      m.calls += 1
      byModel7d.set(model, m)

      cacheRead7d += Number(r.cached_input_tokens ?? 0) || 0
      inputTotal7d += (Number(r.input_tokens ?? 0) || 0) + (Number(r.cached_input_tokens ?? 0) || 0)
    }
  }

  const dayOfMonth = Math.max(1, now.getUTCDate())
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const projectedMicro = Math.round((monthMicro / dayOfMonth) * daysInMonth)

  const byPipelineDaily = Array.from(byPipelineDailyMap.values())
    .sort((a, b) => (a.date === b.date ? a.pipeline.localeCompare(b.pipeline) : a.date.localeCompare(b.date)))
    .map((x) => ({ date: x.date, pipeline: x.pipeline, cost: dollarsFromMicroCents(x.costMicro), calls: x.calls }))

  const total7dMicro = Array.from(byPipeline7d.values()).reduce((s, x) => s + x.costMicro, 0)

  const byPipeline7dOut = Array.from(byPipeline7d.values())
    .sort((a, b) => b.costMicro - a.costMicro)
    .map((x) => {
      const cost = dollarsFromMicroCents(x.costMicro)
      const avgPerCall = x.calls ? cost / x.calls : 0
      const percentOfTotal = total7dMicro ? (x.costMicro / total7dMicro) * 100 : 0
      return {
        pipeline: x.pipeline,
        calls: x.calls,
        cost,
        avgPerCall,
        percentOfTotal
      }
    })

  const byModel7dOut = Array.from(byModel7d.values())
    .sort((a, b) => b.costMicro - a.costMicro)
    .map((x) => {
      const cost = dollarsFromMicroCents(x.costMicro)
      const percentOfTotal = total7dMicro ? (x.costMicro / total7dMicro) * 100 : 0
      return {
        model: x.model,
        calls: x.calls,
        cost,
        percentOfTotal
      }
    })

  const cacheHitRate = inputTotal7d ? (cacheRead7d / inputTotal7d) * 100 : 0

  const { data: recentRows, error: recentErr } = await supabase
    .from('ai_call_log')
    .select('created_at,pipeline,model,input_tokens,output_tokens,cost_micro_cents,duration_ms,status')
    .order('created_at', { ascending: false })
    .limit(50)

  if (recentErr) {
    console.error('[admin/ai-costs.get] DB error (recent):', recentErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const recentCalls = (recentRows ?? []).map((r) => ({
    created_at: r.created_at,
    pipeline: r.pipeline,
    model: r.model,
    input_tokens: r.input_tokens ?? 0,
    output_tokens: r.output_tokens ?? 0,
    cost_dollars: dollarsFromMicroCents(Number(r.cost_micro_cents ?? 0) || 0),
    duration_ms: r.duration_ms ?? null,
    status: r.status
  }))

  return {
    topStats: {
      today: dollarsFromMicroCents(todayMicro),
      week: dollarsFromMicroCents(weekMicro),
      month: dollarsFromMicroCents(monthMicro),
      projectedMonthEnd: dollarsFromMicroCents(projectedMicro)
    },
    byPipelineDaily,
    byPipeline7d: byPipeline7dOut,
    byModel7d: byModel7dOut,
    cacheHitRate,
    recentCalls
  }
})
