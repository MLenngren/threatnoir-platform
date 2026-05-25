<template>
  <main class="-mt-6 -mx-6 min-h-[calc(100dvh-5rem)] bg-[#0e131f] p-6 text-white">
    <div class="mx-auto max-w-5xl">
      <header class="flex flex-col gap-4 border-b border-[#1e293b] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-3xl font-black tracking-tight md:text-4xl">Urgent Threats & Advisories</h1>
          <p class="mt-2 max-w-2xl text-sm text-[#94a3b8] md:text-base">Active and archived focus items for SOC teams and threat hunters</p>
        </div>
      </header>

      <!-- Active focus items -->
      <section v-if="activeItems.length > 0" class="mt-8">
        <p class="font-label text-[10px] font-bold uppercase tracking-widest text-[#ef4444]">ACTIVE RIGHT NOW</p>
        <div class="mt-4 grid grid-cols-1 gap-4">
          <article
            v-for="item in activeItems"
            :key="'active-' + item.id"
            class="rounded-2xl border border-[#1e293b] bg-[#161c28] p-5 md:p-6"
            :class="cardBorderClass(item.severity)"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" :class="severityBadgeClass(item.severity)">{{ item.severity.toUpperCase() }}</span>
              <span class="rounded-full border border-[#1e293b] bg-[#161c28] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{{ categoryLabel(item.category) }}</span>
              <span class="font-label text-[10px] uppercase tracking-widest text-[#64748b]">{{ relativeTime(item.created_at) }}</span>
            </div>
            <h3 class="mt-3 text-lg font-bold text-white">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#cbd5e1]">{{ item.summary }}</p>
            <div v-if="item.action_required" class="mt-4 flex items-start gap-3 rounded-lg border border-red-500/25 bg-[#0e131f] px-4 py-3">
              <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-[#ef4444]" />
              <div class="min-w-0">
                <div class="text-xs font-bold uppercase tracking-widest text-[#ef4444]">Action required</div>
                <div class="mt-1 text-sm font-semibold text-white">{{ item.action_required }}</div>
              </div>
            </div>
            <div v-if="(item.affected_products ?? []).length" class="mt-3 flex flex-wrap gap-2">
              <span v-for="p in item.affected_products" :key="p" class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{{ p }}</span>
            </div>
            <div v-if="(item.cve_ids ?? []).length" class="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              <a v-for="cve in item.cve_ids" :key="cve" :href="`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-[#4cd7f6] hover:underline">{{ cve }}</a>
            </div>
            <div v-if="(item.articles ?? []).length" class="mt-4 flex flex-wrap gap-3">
              <a
                v-for="a in item.articles"
                :key="a.id"
                :href="a.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-[#4cd7f6] hover:underline"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3.5 w-3.5" />
                {{ a.title }}
              </a>
            </div>
          </article>
        </div>
      </section>

      <!-- Archive section -->
      <section class="mt-10 space-y-4">
        <p class="font-label text-[10px] font-bold uppercase tracking-widest text-[#64748b]">ARCHIVE</p>
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Category:</span>
            <button
              v-for="c in categoryOptions"
              :key="c.key"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors"
              :class="c.key === category ? 'bg-white/10 text-white' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'"
              @click="setCategory(c.key)"
            >
              {{ c.label }}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Severity:</span>
            <button
              v-for="s in severityOptions"
              :key="s.key"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors"
              :class="severityPillClass(s.key)"
              @click="setSeverity(s.key)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="mt-6">
        <div v-if="loading && items.length === 0" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-[#94a3b8]">
          Loading focus items…
        </div>

        <div v-else-if="error" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-red-200">
          {{ error }}
        </div>

        <div v-else-if="items.length === 0" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-10 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#0e131f] ring-1 ring-[#1e293b]">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-[#ef4444]" />
          </div>
          <div class="text-base font-bold">No focus items found.</div>
          <div class="mt-1 text-sm text-[#94a3b8]">Try a different filter.</div>
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="item in items"
            :key="item.id"
            class="rounded-2xl border border-[#1e293b] bg-[#161c28] p-5 md:p-6 border-l-4 border-l-[#334155]"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" :class="severityBadgeClass(item.severity)">
                    {{ item.severity.toUpperCase() }}
                  </span>
                  <span class="rounded-full border border-[#1e293b] bg-[#161c28] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    {{ categoryLabel(item.category) }}
                  </span>
                  <span class="font-label text-[10px] uppercase tracking-widest text-[#64748b]">
                    {{ relativeTime(item.created_at) }}
                  </span>
                </div>

                <h2 class="mt-3 text-lg font-bold text-white">{{ item.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-[#cbd5e1]">{{ item.summary }}</p>

                <div
                  v-if="item.action_required && item.action_required.trim()"
                  class="mt-4 rounded-lg border border-red-500/20 bg-[#0e131f] px-4 py-3"
                >
                  <div class="flex items-start gap-3">
                    <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-[#ef4444]" />
                    <div class="min-w-0">
                      <div class="text-xs font-bold uppercase tracking-widest text-[#ef4444]">Action required</div>
                      <div class="mt-1 text-sm font-semibold text-white">{{ item.action_required }}</div>
                    </div>
                  </div>
                </div>

                <div v-if="(item.affected_products ?? []).length" class="mt-4">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Affected products</div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      v-for="p in (item.affected_products ?? []).slice(0, 14)"
                      :key="p"
                      class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94a3b8]"
                    >
                      {{ p }}
                    </span>
                  </div>
                </div>

                <div v-if="(item.cve_ids ?? []).length" class="mt-4">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">CVE IDs</div>
                  <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <a
                      v-for="cve in (item.cve_ids ?? []).slice(0, 14)"
                      :key="cve"
                      :href="`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-bold text-[#4cd7f6] hover:underline"
                    >
                      {{ cve }}
                    </a>
                  </div>
                </div>

                <div v-if="(item.articles ?? []).length" class="mt-5">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Source article</div>
                  <ul class="mt-2 space-y-1 text-sm">
                    <li v-for="a in item.articles.slice(0, 8)" :key="a.id">
                      <a
                        :href="safeHref(a.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1.5 text-[#4cd7f6] hover:underline"
                      >
                        <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3.5 w-3.5 shrink-0" />
                        {{ a.title }}
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </article>

          <div v-if="canLoadMore" class="pt-2">
            <button
              type="button"
              class="w-full rounded-xl border border-[#1e293b] bg-[#161c28] px-4 py-3 text-sm font-bold text-[#94a3b8] hover:text-white disabled:opacity-60"
              :disabled="loadingMore"
              @click="loadMore"
            >
              <span v-if="loadingMore" class="inline-flex items-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-[#94a3b8]/40 border-t-[#ef4444]" />
                Loading…
              </span>
              <span v-else>Load more</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

type FocusSeverity = 'critical' | 'high' | 'medium'
type FocusCategory = 'cve' | 'breach' | 'exploit' | 'campaign' | 'advisory'

type FocusItem = {
  id: string
  title: string
  slug: string
  summary: string
  severity: FocusSeverity
  category: FocusCategory
  cve_ids: string[]
  affected_products: string[]
  action_required: string | null
  article_ids: string[]
  articles: Array<{ id: string; title: string; url: string }>
  ioc_summary: string | null
  source_urls: string[]
  status: 'pending' | 'active' | 'archived'
  expires_at: string | null
  created_at: string
  updated_at: string
}

type ArchiveResponse = { items: FocusItem[]; total: number }

useHead({
  title: 'Urgent Threats & Advisories | ThreatNoir',
  meta: [{ name: 'description', content: 'Active and archived urgent security threats, CVEs, and advisories for SOC teams and threat hunters.' }]
})

const { data: activeData } = await useFetch<{ items: FocusItem[] }>('/api/focus')
const activeItems = computed(() => activeData.value?.items ?? [])

const categoryOptions: Array<{ key: '' | FocusCategory; label: string }> = [
  { key: '', label: 'All' },
  { key: 'cve', label: 'CVE' },
  { key: 'breach', label: 'Breach' },
  { key: 'exploit', label: 'Exploit' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'advisory', label: 'Advisory' }
]

const severityOptions: Array<{ key: '' | FocusSeverity; label: string }> = [
  { key: '', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' }
]

const category = ref<'' | FocusCategory>('')
const severity = ref<'' | FocusSeverity>('')

const items = ref<FocusItem[]>([])
const total = ref(0)
const limit = 20
const offset = ref(0)
const loadingMore = ref(false)
const error = ref<string | null>(null)

function setCategory(v: '' | FocusCategory) {
  category.value = v
}

function setSeverity(v: '' | FocusSeverity) {
  severity.value = v
}

const canLoadMore = computed(() => items.value.length < total.value)

const baseQuery = computed(() => {
  const q: Record<string, string | number | undefined> = { limit, offset: 0 }
  if (category.value) q.category = category.value
  if (severity.value) q.severity = severity.value
  return q
})

const { data, pending, error: fetchError } = useFetch<ArchiveResponse>('/api/focus/archive', {
  query: baseQuery
})

const loading = computed(() => pending.value)

watch(
  data,
  (res) => {
    if (!res) return
    items.value = Array.isArray(res.items) ? res.items : []
    total.value = typeof res.total === 'number' ? res.total : items.value.length
    offset.value = items.value.length
  },
  { immediate: true }
)

watch(
  fetchError,
  (e) => {
    error.value = e ? getErrorMessage(e) : null
  },
  { immediate: true }
)

async function loadMore() {
  if (loading.value || loadingMore.value || !canLoadMore.value) return
  loadingMore.value = true
  try {
    const res = await $fetch<ArchiveResponse>('/api/focus/archive', {
      query: {
        ...baseQuery.value,
        offset: offset.value
      }
    })

    const nextItems = Array.isArray(res.items) ? res.items : []
    items.value = [...items.value, ...nextItems]
    total.value = typeof res.total === 'number' ? res.total : total.value
    offset.value = items.value.length
  } catch (e: unknown) {
    error.value = getErrorMessage(e)
  } finally {
    loadingMore.value = false
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function categoryLabel(c: FocusCategory): string {
  if (c === 'cve') return 'CVE'
  if (c === 'breach') return 'BREACH'
  if (c === 'exploit') return 'EXPLOIT'
  if (c === 'campaign') return 'CAMPAIGN'
  return 'ADVISORY'
}

function cardBorderClass(s: FocusSeverity): string {
  if (s === 'critical') return 'border-l-4 border-l-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.1)]'
  if (s === 'high') return 'border-l-4 border-l-[#f97316]'
  return 'border-l-4 border-l-[#eab308]'
}

function severityBadgeClass(s: FocusSeverity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (s === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/25'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
}

function severityPillClass(key: '' | FocusSeverity): string {
  const isSelected = key === severity.value
  if (!key) {
    return isSelected ? 'bg-white/10 text-white' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
  }
  if (key === 'critical') {
    return isSelected ? 'bg-[#ef4444]/15 text-red-200 border border-[#ef4444]/30' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
  }
  if (key === 'high') {
    return isSelected ? 'bg-[#f97316]/15 text-orange-200 border border-[#f97316]/30' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
  }
  return isSelected ? 'bg-[#eab308]/15 text-yellow-200 border border-[#eab308]/30' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
}

function getErrorMessage(e: unknown): string {
  const anyE = e as Record<string, unknown>
  const msg = (anyE?.data as Record<string, unknown> | undefined)?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  if (typeof anyE?.statusMessage === 'string' && anyE.statusMessage.trim()) return anyE.statusMessage
  if (typeof anyE?.message === 'string' && anyE.message.trim()) return anyE.message
  return 'Something went wrong.'
}
</script>
