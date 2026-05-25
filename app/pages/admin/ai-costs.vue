<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">AI Costs</h1>
        <p class="mt-1 text-sm text-gray-300">Per-call Anthropic spend by pipeline and model.</p>
      </div>
      <div v-if="pending" class="text-sm text-gray-400">Loading…</div>
    </div>

    <!-- Top stats -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Today</div>
        <div class="mt-2 text-2xl font-semibold">{{ fmtUsd(data?.topStats.today) }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">This week (7d)</div>
        <div class="mt-2 text-2xl font-semibold">{{ fmtUsd(data?.topStats.week) }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">This month</div>
        <div class="mt-2 text-2xl font-semibold">{{ fmtUsd(data?.topStats.month) }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Projected month-end</div>
        <div class="mt-2 text-2xl font-semibold">{{ fmtUsd(data?.topStats.projectedMonthEnd) }}</div>
      </UCard>
    </div>

    <!-- By pipeline (7d) -->
    <UCard>
      <div class="flex items-baseline justify-between gap-4">
        <div>
          <div class="text-xs uppercase tracking-wider text-gray-400">By pipeline (last 7 days)</div>
          <div class="mt-1 text-sm text-gray-400">Cache hit rate: {{ fmtPct(data?.cacheHitRate) }}</div>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th class="py-2 text-left">Pipeline</th>
              <th class="py-2 text-right">Calls</th>
              <th class="py-2 text-right">Cost</th>
              <th class="py-2 text-right">Avg/call</th>
              <th class="py-2 text-right">% of total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in (data?.byPipeline7d ?? [])" :key="r.pipeline" class="border-t border-gray-800">
              <td class="py-2 font-mono text-xs">{{ r.pipeline }}</td>
              <td class="py-2 text-right text-gray-300">{{ r.calls }}</td>
              <td class="py-2 text-right">{{ fmtUsd(r.cost) }}</td>
              <td class="py-2 text-right text-gray-300">{{ fmtUsd(r.avgPerCall) }}</td>
              <td class="py-2 text-right text-gray-300">{{ fmtPct(r.percentOfTotal) }}</td>
            </tr>
            <tr v-if="(data?.byPipeline7d ?? []).length === 0" class="border-t border-gray-800">
              <td colspan="5" class="py-6 text-center text-gray-400">No data yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Daily chart (30d) -->
    <UCard>
      <div class="text-xs uppercase tracking-wider text-gray-400">By pipeline daily (last 30 days)</div>
      <div class="mt-4 overflow-x-auto">
        <div class="flex items-end gap-2 pb-2" :style="{ minWidth: `${Math.max(28, chartDates.length) * 14}px` }">
          <div v-for="d in chartDates" :key="d" class="flex w-3 flex-col items-center gap-2" :title="d">
            <div class="flex w-3 flex-col-reverse overflow-hidden rounded bg-gray-900" :style="{ height: `${barHeight(d)}px` }">
              <div
                v-for="seg in chartSegments(d)"
                :key="seg.pipeline"
                :style="{ height: `${seg.px}px`, backgroundColor: seg.color }"
                class="w-3"
              />
            </div>
            <div class="w-10 text-center text-[10px] leading-3 text-gray-500">{{ shortDate(d) }}</div>
          </div>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
        <div v-for="p in legendPipelines" :key="p" class="flex items-center gap-2">
          <span class="h-2 w-2 rounded" :style="{ backgroundColor: colorFor(p) }" />
          <span class="font-mono">{{ p }}</span>
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- By model -->
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">By model (last 7 days)</div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th class="py-2 text-left">Model</th>
                <th class="py-2 text-right">Calls</th>
                <th class="py-2 text-right">Cost</th>
                <th class="py-2 text-right">% of total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in (data?.byModel7d ?? [])" :key="r.model" class="border-t border-gray-800">
                <td class="py-2 font-mono text-xs">{{ r.model }}</td>
                <td class="py-2 text-right text-gray-300">{{ r.calls }}</td>
                <td class="py-2 text-right">{{ fmtUsd(r.cost) }}</td>
                <td class="py-2 text-right text-gray-300">{{ fmtPct(r.percentOfTotal) }}</td>
              </tr>
              <tr v-if="(data?.byModel7d ?? []).length === 0" class="border-t border-gray-800">
                <td colspan="4" class="py-6 text-center text-gray-400">No data yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Recent calls -->
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Recent calls</div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th class="py-2 text-left">Time</th>
                <th class="py-2 text-left">Pipeline</th>
                <th class="py-2 text-left">Model</th>
                <th class="py-2 text-right">In</th>
                <th class="py-2 text-right">Out</th>
                <th class="py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in (data?.recentCalls ?? [])" :key="r.created_at + r.pipeline" class="border-t border-gray-800">
                <td class="py-2 font-mono text-xs text-gray-400">{{ shortTs(r.created_at) }}</td>
                <td class="py-2 font-mono text-xs">{{ r.pipeline }}</td>
                <td class="py-2 font-mono text-xs text-gray-300">{{ r.model }}</td>
                <td class="py-2 text-right text-gray-300">{{ r.input_tokens }}</td>
                <td class="py-2 text-right text-gray-300">{{ r.output_tokens }}</td>
                <td class="py-2 text-right">{{ fmtUsd(r.cost_dollars) }}</td>
              </tr>
              <tr v-if="(data?.recentCalls ?? []).length === 0" class="border-t border-gray-800">
                <td colspan="6" class="py-6 text-center text-gray-400">No calls logged yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type Response = {
  topStats: { today: number; week: number; month: number; projectedMonthEnd: number }
  byPipelineDaily: Array<{ date: string; pipeline: string; cost: number; calls: number }>
  byPipeline7d: Array<{ pipeline: string; calls: number; cost: number; avgPerCall: number; percentOfTotal: number }>
  byModel7d: Array<{ model: string; calls: number; cost: number; percentOfTotal: number }>
  cacheHitRate: number
  recentCalls: Array<{ created_at: string; pipeline: string; model: string; input_tokens: number; output_tokens: number; cost_dollars: number }>
}

const { data, pending } = await useFetch<Response>('/api/admin/ai-costs')

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
function fmtUsd(v: unknown): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return usd.format(n)
}
function fmtPct(v: unknown): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return `${n.toFixed(1)}%`
}

const daily = computed(() => data.value?.byPipelineDaily ?? [])
const chartDates = computed(() => Array.from(new Set(daily.value.map((r) => r.date))).sort())

const totalsByDate = computed(() => {
  const m = new Map<string, number>()
  for (const r of daily.value) m.set(r.date, (m.get(r.date) ?? 0) + (r.cost ?? 0))
  return m
})

const maxTotal = computed(() => Math.max(1, ...Array.from(totalsByDate.value.values())))

function colorFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 55%)`
}

function barHeight(date: string): number {
  const total = totalsByDate.value.get(date) ?? 0
  const px = Math.round((total / maxTotal.value) * 120)
  return Math.max(2, px)
}

function chartSegments(date: string): Array<{ pipeline: string; px: number; color: string }> {
  const rows = daily.value.filter((r) => r.date === date && (r.cost ?? 0) > 0)
  const total = (totalsByDate.value.get(date) ?? 0) || 0
  const height = barHeight(date)
  if (!total) return []

  // Largest first so the small segments end up on top.
  const sorted = [...rows].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
  const segs = sorted.map((r) => ({ pipeline: r.pipeline, cost: r.cost ?? 0 }))

  let used = 0
  const out: Array<{ pipeline: string; px: number; color: string }> = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    const isLast = i === segs.length - 1
    const px = isLast ? Math.max(1, height - used) : Math.max(1, Math.floor((s.cost / total) * height))
    used += px
    out.push({ pipeline: s.pipeline, px, color: colorFor(s.pipeline) })
  }
  return out
}

const legendPipelines = computed(() => (data.value?.byPipeline7d ?? []).slice(0, 8).map((r) => r.pipeline))

function shortDate(date: string): string {
  try {
    const d = new Date(`${date}T00:00:00Z`)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return date
  }
}

function shortTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
</script>
