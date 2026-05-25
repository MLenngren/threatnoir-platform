<template>
  <div class="-m-6 min-h-full bg-[#0e131f] p-6 text-white">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p class="mt-1 text-sm text-[#94a3b8]">Self-hosted event tracking (page views, signups, podcast plays).</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="opt in rangeOptions"
          :key="opt.value"
          type="button"
          class="rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition"
          :class="range === opt.value
            ? 'border-[#4cd7f6]/60 bg-[#161c28] text-white'
            : 'border-[#1e293b] bg-[#0e131f] text-[#94a3b8] hover:bg-[#161c28] hover:text-white'"
          @click="range = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Total Views</div>
        <div class="mt-1 text-3xl font-black text-white">{{ data?.total_views ?? 0 }}</div>
      </div>
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#4cd7f6]">Unique Visitors</div>
        <div class="mt-1 text-3xl font-black text-white">{{ data?.unique_visitors ?? 0 }}</div>
      </div>
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#22c55e]">Signups</div>
        <div class="mt-1 text-3xl font-black text-white">{{ data?.signups ?? 0 }}</div>
      </div>
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#eab308]">Podcast Plays</div>
        <div class="mt-1 text-3xl font-black text-white">{{ data?.podcast_plays ?? 0 }}</div>
      </div>
    </div>

    <!-- Daily views chart -->
    <div class="mt-6 rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
      <div class="flex items-baseline justify-between gap-4">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Daily Page Views</div>
          <div class="mt-1 text-xs text-[#64748b]">
            {{ periodLabel }}
          </div>
        </div>
        <div v-if="pending" class="text-xs text-[#94a3b8]">Loading…</div>
      </div>

      <div v-if="!pending" class="mt-4 overflow-x-auto">
        <div class="flex items-end gap-2 pb-2" :style="{ minWidth: `${Math.max(28, bars.length) * 14}px` }">
          <div
            v-for="b in bars"
            :key="b.date"
            class="flex w-3 flex-col items-center gap-2"
            :title="`${b.date}: ${b.count}`"
          >
            <div
              class="w-3 rounded bg-[#4cd7f6]"
              :style="{ height: `${Math.max(2, Math.round((b.count / maxBar) * 120))}px`, opacity: b.count ? 1 : 0.25 }"
            />
            <div class="w-10 text-center text-[10px] leading-3 text-[#64748b]">
              {{ shortDate(b.date) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tables -->
    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="overflow-hidden rounded-lg border border-[#1e293b] bg-[#161c28]">
        <div class="border-b border-[#1e293b] bg-[#0e131f] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
          Top Pages
        </div>
        <table class="w-full text-sm">
          <thead class="sr-only"><tr><th>Path</th><th>Views</th></tr></thead>
          <tbody>
            <tr v-for="p in (data?.top_pages ?? [])" :key="p.path" class="border-t border-[#1e293b] hover:bg-[#1a2231]">
              <td class="px-4 py-3 font-mono text-xs text-white/90">{{ p.path }}</td>
              <td class="px-4 py-3 text-right text-[#94a3b8]">{{ p.views }}</td>
            </tr>
            <tr v-if="(data?.top_pages ?? []).length === 0" class="border-t border-[#1e293b]">
              <td colspan="2" class="px-4 py-6 text-center text-sm text-[#94a3b8]">No data yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="overflow-hidden rounded-lg border border-[#1e293b] bg-[#161c28]">
        <div class="border-b border-[#1e293b] bg-[#0e131f] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
          Top Referrers
        </div>
        <table class="w-full text-sm">
          <thead class="sr-only"><tr><th>Referrer</th><th>Count</th></tr></thead>
          <tbody>
            <tr
              v-for="r in (data?.top_referrers ?? [])"
              :key="r.referrer"
              class="border-t border-[#1e293b] hover:bg-[#1a2231]"
            >
              <td class="px-4 py-3 font-mono text-xs text-white/90">{{ r.referrer }}</td>
              <td class="px-4 py-3 text-right text-[#94a3b8]">{{ r.count }}</td>
            </tr>
            <tr v-if="(data?.top_referrers ?? []).length === 0" class="border-t border-[#1e293b]">
              <td colspan="2" class="px-4 py-6 text-center text-sm text-[#94a3b8]">No data yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-[#1e293b] bg-[#161c28]">
      <div class="border-b border-[#1e293b] bg-[#0e131f] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
        Event Breakdown
      </div>
      <table class="w-full text-sm">
        <thead class="bg-[#0e131f] text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
          <tr>
            <th class="px-4 py-3 text-left">Event</th>
            <th class="px-4 py-3 text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="e in (data?.event_breakdown ?? [])"
            :key="e.event_type"
            class="border-t border-[#1e293b] hover:bg-[#1a2231]"
          >
            <td class="px-4 py-3 font-mono text-xs text-white/90">{{ e.event_type }}</td>
            <td class="px-4 py-3 text-right text-[#94a3b8]">{{ e.count }}</td>
          </tr>
          <tr v-if="(data?.event_breakdown ?? []).length === 0" class="border-t border-[#1e293b]">
            <td colspan="2" class="px-4 py-6 text-center text-sm text-[#94a3b8]">No data yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type RangeKey = '7d' | '30d' | '90d'

type Response = {
  period: { from: string; to: string }
  daily_views: Array<{ date: string; count: number }>
  total_views: number
  unique_visitors: number
  top_pages: Array<{ path: string; views: number }>
  top_referrers: Array<{ referrer: string; count: number }>
  event_breakdown: Array<{ event_type: string; count: number }>
  signups: number
  podcast_plays: number
}

const rangeOptions: Array<{ label: string; value: RangeKey }> = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' }
]

const range = ref<RangeKey>('30d')

const query = computed(() => ({ range: range.value }))

const { data, pending } = await useFetch<Response>('/api/admin/analytics', {
  query,
  watch: [query]
})

const bars = computed(() => data.value?.daily_views ?? [])
const maxBar = computed(() => Math.max(1, ...bars.value.map((b) => b.count)))

const periodLabel = computed(() => {
  const p = data.value?.period
  if (!p) return ''
  try {
    const from = new Date(p.from)
    const to = new Date(p.to)
    return `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → ${to.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  } catch {
    return ''
  }
})

function shortDate(date: string): string {
  try {
    const d = new Date(`${date}T00:00:00Z`)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return date
  }
}
</script>
