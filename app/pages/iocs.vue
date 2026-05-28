<template>
	  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
	      <section class="glass-panel rounded-2xl p-6 md:p-8">
	        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
	          <div>
	            <div class="flex items-center gap-3">
	              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Command search</span>
		              <span class="h-1 w-1 rounded-full bg-white/15" />
		              <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
		                For SOC analysts
		              </span>
	            </div>
	            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
	              IOC SEARCH
	            </h1>
	            <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	              Search Indicators of Compromise extracted from approved articles.
	            </p>
	          </div>
	        </div>

	        <div class="mt-6 grid gap-3 md:grid-cols-12">
	          <div class="md:col-span-8">
	            <div class="flex items-center gap-3 rounded-xl bg-tn-surface-high/70 px-3 py-2 ring-1 ring-white/10">
	              <label class="sr-only" for="ioc-search">Search</label>
	              <input
	                id="ioc-search"
	                v-model="search"
	                type="search"
	                placeholder="Search IOC value (domain, IP, hash, CVE…)"
	                class="w-full bg-transparent px-2 py-2 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant focus:outline-none"
	              >
	              <button
	                v-if="search"
	                type="button"
	                class="shrink-0 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	                @click="search = ''"
	              >
	                Clear
	              </button>
	            </div>
	          </div>

	          <div class="md:col-span-4">
	            <label class="sr-only" for="ioc-type">Type</label>
	            <select
	              id="ioc-type"
	              v-model="type"
	              class="w-full rounded-xl bg-tn-surface-high/70 px-3 py-3 text-sm text-tn-on-surface ring-1 ring-white/10 focus:outline-none"
	            >
	              <option value="">All types</option>
	              <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
	            </select>
	          </div>
	        </div>
	      </section>

	      <section class="mt-10">
	        <div class="overflow-hidden rounded-2xl bg-tn-surface-lowest/40 ring-1 ring-white/10">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
	                <tr class="bg-tn-surface-high/40">
	                  <th class="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Type</th>
	                  <th class="px-4 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Value</th>
	                  <th class="px-4 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Context</th>
	                  <th class="px-4 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Article</th>
	                  <th class="px-4 py-3 text-right font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Date</th>
                </tr>
              </thead>
              <tbody>
	                <tr v-if="!items.length" class="border-t border-white/5">
	                  <td class="px-5 py-6 text-sm text-tn-on-surface-variant" colspan="5">
                    {{ loading ? 'Loading…' : 'No results.' }}
                  </td>
                </tr>

                <tr
                  v-for="(ioc, idx) in items"
                  :key="idx"
	                  class="border-t border-white/5 transition-colors hover:bg-tn-surface-container/30"
                >
	                  <td class="px-5 py-4">
	                    <span
	                      class="inline-flex items-center rounded-full px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest ring-1"
	                      :class="typeBadgeClass(ioc.type)"
	                    >
	                      {{ typeLabel(ioc.type) }}
	                    </span>
	                  </td>
	                  <td class="px-4 py-4">
	                    <code class="rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs text-tn-on-surface ring-1 ring-white/10">
	                      {{ ioc.value }}
	                    </code>
	                  </td>
	                  <td class="max-w-[420px] px-4 py-4 text-xs leading-relaxed text-tn-on-surface-variant">
                    <span v-if="ioc.context">{{ ioc.context }}</span>
	                    <span v-else class="text-white/30">—</span>
                  </td>
	                  <td class="px-4 py-4">
                    <a
	                      v-if="safeHref(ioc.article?.url) !== '#'"
	                      :href="safeHref(ioc.article?.url)"
                      target="_blank"
                      rel="noopener noreferrer"
	                      class="text-sm font-semibold text-tn-on-surface hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
                    >
                      {{ ioc.article?.title || 'Open article' }}
                    </a>
	                    <span v-else class="text-white/30">—</span>
                  </td>
	                  <td class="px-4 py-4 text-right font-mono text-xs text-tn-on-surface-variant">
                    {{ formatDate(ioc.article?.published_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

	        <div class="mt-10 flex items-center justify-center">
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
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { safeHref } from '~/composables/useSafeHref'

type IocItem = {
  type: string
  value: string
  context: string | null
  article: { id: string; title: string; url: string; published_at: string | null }
}

type IocsResponse = {
  items: IocItem[]
  hasMore: boolean
  nextOffset: number
}

const types = [
  'ip',
  'domain',
  'hash_md5',
  'hash_sha1',
  'hash_sha256',
  'url',
  'cve',
  'mitre_attack',
  'email',
  'malware'
]

useSeoMeta({
  title: 'IOC Search | ThreatNoir',
  description: 'Search 10,000+ indicators of compromise by IP, domain, hash, CVE, or malware family. Free for SOC analysts and threat hunters. Updated daily.',
  ogTitle: 'IOC Search | ThreatNoir',
  ogDescription: 'Search 10,000+ indicators of compromise by IP, domain, hash, CVE, or malware family. Free for SOC analysts and threat hunters. Updated daily.',
  ogImage: 'https://threatnoir.com/images/category-default.png',
  ogUrl: 'https://threatnoir.com/iocs',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'IOC Search | ThreatNoir',
  twitterDescription: 'Search 10,000+ indicators of compromise by IP, domain, hash, CVE, or malware family. Free for SOC analysts and threat hunters. Updated daily.',
  twitterImage: 'https://threatnoir.com/images/category-default.png',
  author: 'ThreatNoir'
})

const search = ref('')
const type = ref('')
const pageSize = 50

const nextOffset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)
const items = ref<IocItem[]>([])

const baseQuery = computed(() => {
  const q: Record<string, string | number | undefined> = {
    limit: pageSize,
    offset: 0
  }
  if (search.value.trim()) q.q = search.value.trim()
  if (type.value) q.type = type.value
  return q
})

const debouncedQuery = ref(baseQuery.value)
const syncDebounced = useDebounceFn(() => {
  debouncedQuery.value = baseQuery.value
}, 250)

watch([search, type], () => syncDebounced())

const { data, pending } = useFetch<IocsResponse>('/api/v1/iocs', {
  query: debouncedQuery
})

const loading = computed(() => pending.value)

watch(
  data,
  (res) => {
    if (!res) return
    items.value = res.items ?? []
    nextOffset.value = res.nextOffset ?? 0
    hasMore.value = !!res.hasMore
  },
  { immediate: true }
)

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const res = await $fetch<IocsResponse>('/api/v1/iocs', {
      query: {
        ...debouncedQuery.value,
        offset: nextOffset.value
      }
    })
    items.value = [...items.value, ...(res.items ?? [])]
    nextOffset.value = res.nextOffset ?? nextOffset.value
    hasMore.value = !!res.hasMore
  } finally {
    loadingMore.value = false
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return '—'
  }
}

function typeLabel(type: string): string {
  const t = (type || '').toLowerCase()
  if (t === 'ip') return 'IP'
  if (t === 'domain') return 'Domain'
  if (t === 'url') return 'URL'
  if (t === 'cve') return 'CVE'
  if (t === 'mitre_attack') return 'MITRE'
  if (t === 'email') return 'Email'
  if (t === 'malware') return 'Malware'
  if (t.startsWith('hash_')) return 'Hash'
  return t || 'IOC'
}

function typeBadgeClass(type: string): string {
  const t = (type || '').toLowerCase()
  if (t === 'cve') return 'bg-red-950/20 text-red-200 ring-red-500/25'
  if (t === 'ip') return 'bg-sky-950/20 text-sky-200 ring-sky-500/25'
  if (t === 'domain') return 'bg-cyan-950/20 text-cyan-200 ring-cyan-500/25'
  if (t === 'url') return 'bg-emerald-950/20 text-emerald-200 ring-emerald-500/25'
  if (t.startsWith('hash_')) return 'bg-amber-950/20 text-amber-200 ring-amber-500/25'
  if (t === 'mitre_attack') return 'bg-fuchsia-950/20 text-fuchsia-200 ring-fuchsia-500/25'
  if (t === 'email') return 'bg-violet-950/20 text-violet-200 ring-violet-500/25'
  if (t === 'malware') return 'bg-rose-950/20 text-rose-200 ring-rose-500/25'
  return 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10'
}
</script>
