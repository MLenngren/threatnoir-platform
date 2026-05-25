<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Header -->
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex items-center gap-3">
          <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
          <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Regulatory intel</span>
        </div>
        <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
          REGULATORY INTELLIGENCE
        </h1>
	        <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	          Enforcement, fines, and compliance updates—filtered by regulation and jurisdiction.
	        </p>
      </section>

      <!-- Filters -->
	      <section class="mt-6 glass-panel rounded-2xl p-4 md:p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="sr-only" for="legal-jurisdiction">Jurisdiction</label>
              <select
                id="legal-jurisdiction"
                v-model="jurisdiction"
	                class="w-full rounded-xl bg-tn-surface-high/70 px-3 py-3 text-sm text-tn-on-surface ring-1 ring-white/10 focus:outline-none"
              >
                <option value="">All jurisdictions</option>
                <option v-for="j in jurisdictionOptions" :key="j" :value="j">
                  {{ j }}
                </option>
              </select>
            </div>

            <div>
              <label class="sr-only" for="legal-regulation">Regulation</label>
              <select
                id="legal-regulation"
                v-model="regulation"
	                class="w-full rounded-xl bg-tn-surface-high/70 px-3 py-3 text-sm text-tn-on-surface ring-1 ring-white/10 focus:outline-none"
              >
                <option value="">All regulations</option>
                <option v-for="r in regulationOptions" :key="r" :value="r">
                  {{ r }}
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
	            class="inline-flex items-center justify-center rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest disabled:opacity-50"
            :disabled="!jurisdiction && !regulation"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>
      </section>

      <!-- Results -->
	      <section class="mt-6 overflow-hidden rounded-2xl bg-tn-surface-lowest/40 ring-1 ring-white/10">
	        <div v-if="pending" class="p-6 text-sm text-tn-on-surface-variant">Loading…</div>

	        <div v-else-if="!items.length" class="p-10 text-center">
	          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
	            <UIcon name="i-heroicons-scale" class="h-6 w-6 text-tn-primary" />
	          </div>
	          <div class="mt-4 font-headline text-base font-bold text-tn-on-surface">No regulatory articles found.</div>
	          <div class="mt-1 text-sm text-tn-on-surface-variant">Try adjusting your filters.</div>
	        </div>

        <div v-else>
          <!-- Desktop table -->
          <div class="hidden md:block">
            <div class="overflow-x-auto">
	              <table class="w-full text-left text-sm">
	                <thead>
	                  <tr class="bg-tn-surface-high/40">
	                    <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Date</th>
	                    <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Headline</th>
	                    <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Regulation</th>
	                    <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Jurisdiction</th>
	                    <th v-if="showFineColumn" class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Fine</th>
	                    <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Source</th>
	                  </tr>
	                </thead>
	                <tbody>
                  <tr
                    v-for="row in items"
                    :key="row.id"
	                    class="group border-t border-white/5 transition-colors duration-100 hover:bg-tn-surface-container/30"
                  >
	                    <td class="whitespace-nowrap px-5 py-4 font-mono text-xs text-tn-on-surface-variant">
                      {{ relativeTime(row) }}
                    </td>

                    <td class="px-5 py-4">
	                      <a
	                        class="block text-pretty text-sm font-semibold leading-relaxed text-tn-on-surface hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
                        :href="safeHref(row.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ displayLine(row) }}
                      </a>
                    </td>

                    <td class="px-5 py-4">
	                      <span
	                        v-if="row.regulation"
	                        class="inline-flex items-center rounded-full px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest ring-1"
	                        :class="regulationBadgeClass(row.regulation)"
	                      >
                        {{ row.regulation }}
                      </span>
	                      <span v-else class="text-xs text-white/30">—</span>
                    </td>

	                    <td class="px-5 py-4 text-sm text-tn-on-surface">
                      <span v-if="row.jurisdiction">{{ row.jurisdiction }}</span>
	                      <span v-else class="text-xs text-white/30">—</span>
                    </td>

	                    <td v-if="showFineColumn" class="px-5 py-4">
	                      <span v-if="row.fine_amount" class="font-semibold text-tn-on-surface">{{ row.fine_amount }}</span>
	                      <span v-else class="text-xs text-white/30">—</span>
                    </td>

	                    <td class="px-5 py-4 text-xs text-tn-on-surface-variant">
	                      <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10">
	                        {{ row.source?.name ?? 'Source' }}
	                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mobile cards -->
          <div class="md:hidden">
	            <ol class="space-y-3 p-4">
	              <li v-for="row in items" :key="row.id" class="glass-panel rounded-2xl border-l-4 border-l-tn-primary/60 p-5">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
	                    <div class="mb-3 flex flex-wrap items-center gap-2">
	                      <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ relativeTime(row) }}</span>
	                      <span v-if="row.jurisdiction" class="h-1 w-1 rounded-full bg-white/20" />
	                      <span v-if="row.jurisdiction" class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface">{{ row.jurisdiction }}</span>
                    </div>

	                    <a
	                      class="block text-pretty text-sm font-semibold leading-relaxed text-tn-on-surface hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
                      :href="safeHref(row.url)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ displayLine(row) }}
                    </a>

	                    <div class="mt-4 flex flex-wrap items-center gap-2">
	                      <span
	                        v-if="row.regulation"
	                        class="inline-flex items-center rounded-full px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest ring-1"
	                        :class="regulationBadgeClass(row.regulation)"
	                      >
                        {{ row.regulation }}
                      </span>
	                      <span v-if="row.fine_amount" class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10">
                        {{ row.fine_amount }}
                      </span>
	                      <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
	                        {{ row.source?.name ?? 'Source' }}
	                      </span>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- Pagination -->
      <div class="mt-8 flex items-center justify-center">
        <button
          v-if="hasMore"
          type="button"
	          class="rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

useSeoMeta({
  title: 'Legal & Privacy — ThreatNoir',
  description: 'Regulatory enforcement, fines, and compliance updates by jurisdiction and regulation.',
  ogTitle: 'Legal & Privacy — ThreatNoir',
  ogDescription: 'Regulatory enforcement, fines, and compliance updates by jurisdiction and regulation.',
  ogType: 'website'
})

type LegalItem = {
  id: string
  title: string
  brief: string | null
  url: string
  jurisdiction: string | null
  regulation: string | null
  fine_amount: string | null
  published_at: string | null
  ingested_at?: string | null
  source: { id: string; name: string; url?: string | null } | null
  category: { id: string; name: string; slug: string } | null
}

type LegalResponse = {
  items: LegalItem[]
  filters: { jurisdictions: string[]; regulations: string[] }
  nextOffset: number
  hasMore: boolean
}

const route = useRoute()
const router = useRouter()

const jurisdiction = ref(typeof route.query.jurisdiction === 'string' ? route.query.jurisdiction : '')
const regulation = ref(typeof route.query.regulation === 'string' ? route.query.regulation : '')

// Keep local state in sync with back/forward navigation.
watch(
  () => route.query,
  (q) => {
    const nextJ = typeof q.jurisdiction === 'string' ? q.jurisdiction : ''
    const nextR = typeof q.regulation === 'string' ? q.regulation : ''
    if (nextJ !== jurisdiction.value) jurisdiction.value = nextJ
    if (nextR !== regulation.value) regulation.value = nextR
  }
)

function normalizeQueryForCompare(q: Record<string, unknown>): string {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === 'string') out[k] = v
  }
  const params = new URLSearchParams()
  for (const k of Object.keys(out).sort()) params.set(k, out[k])
  return params.toString()
}

watch([jurisdiction, regulation], () => {
  const nextQuery: Record<string, string> = {}
  if (jurisdiction.value) nextQuery.jurisdiction = jurisdiction.value
  if (regulation.value) nextQuery.regulation = regulation.value

  // Preserve unrelated query params if they exist.
  const preserved: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'jurisdiction' || k === 'regulation') continue
    if (typeof v === 'string') preserved[k] = v
  }

  const next = { ...preserved, ...nextQuery }
  const currentKey = normalizeQueryForCompare(route.query as Record<string, unknown>)
  const nextKey = normalizeQueryForCompare(next)
  if (currentKey === nextKey) return

  router.replace({ query: next }).catch(() => {})
})

function clearFilters() {
  jurisdiction.value = ''
  regulation.value = ''
}

const pageSize = 50

const baseQuery = computed(() => {
  const q: Record<string, string | number | undefined> = {
    limit: pageSize,
    offset: 0
  }
  if (jurisdiction.value) q.jurisdiction = jurisdiction.value
  if (regulation.value) q.regulation = regulation.value
  return q
})

const { data, pending } = useFetch<LegalResponse>('/api/legal', {
  query: baseQuery
})

const nextOffset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)
const items = ref<LegalItem[]>([])

watch(
  data,
  (res) => {
    if (!res) return
    items.value = Array.isArray(res.items) ? res.items : []
    nextOffset.value = typeof res.nextOffset === 'number' ? res.nextOffset : items.value.length
    hasMore.value = !!res.hasMore
  },
  { immediate: true }
)

const jurisdictionOptions = computed(() => {
  const list = data.value?.filters?.jurisdictions
  return Array.isArray(list) ? list : []
})

const regulationOptions = computed(() => {
  const list = data.value?.filters?.regulations
  return Array.isArray(list) ? list : []
})

const showFineColumn = computed(() => items.value.some((x) => !!x.fine_amount))

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const res = await $fetch<LegalResponse>('/api/legal', {
      query: {
        ...baseQuery.value,
        offset: nextOffset.value
      }
    })

    const newItems = Array.isArray(res.items) ? res.items : []
    items.value = [...items.value, ...newItems]
    nextOffset.value = typeof res.nextOffset === 'number' ? res.nextOffset : nextOffset.value + newItems.length
    hasMore.value = !!res.hasMore
  } finally {
    loadingMore.value = false
  }
}

function displayLine(item: LegalItem): string {
  const b = (item.brief || '').replace(/\s+/g, ' ').trim()
  if (b) return b
  const t = (item.title || '').replace(/\s+/g, ' ').trim()
  if (t.length <= 140) return t
  const cut = t.slice(0, 140)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace >= 60 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function relativeTime(item: LegalItem): string {
  const d = item.published_at || item.ingested_at || null
  if (!d) return '—'

  const ms = Date.now() - new Date(d).getTime()
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec}s ago`

  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`

  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`

  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`

  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function regulationBadgeClass(value: string): string {
  const r = (value || '').toLowerCase()
  if (r.includes('gdpr')) return 'bg-sky-950/20 text-sky-200 ring-sky-500/25'
  if (r.includes('ccpa') || r.includes('cpra')) return 'bg-emerald-950/20 text-emerald-200 ring-emerald-500/25'
  if (r.includes('hipaa')) return 'bg-violet-950/20 text-violet-200 ring-violet-500/25'
  if (r.includes('nis2') || r.includes('nis 2')) return 'bg-amber-950/20 text-amber-200 ring-amber-500/25'
  if (r.includes('dora')) return 'bg-cyan-950/20 text-cyan-200 ring-cyan-500/25'
  if (r.includes('pci')) return 'bg-fuchsia-950/20 text-fuchsia-200 ring-fuchsia-500/25'
  return 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10'
}
</script>
