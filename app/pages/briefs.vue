<template>
	  <main class="grid-bg py-10">
	    <div class="mx-auto max-w-6xl px-6">
	      <section class="glass-panel rounded-2xl p-6 md:p-8">
	        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
	          <div>
	            <div class="flex items-center gap-3">
	              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Daily briefs</span>
	            </div>
	            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
	              DAILY BRIEFS
	            </h1>
	            <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	              Top stories as punchy one-liners—designed to scan in seconds.
	            </p>
	          </div>

	          <div class="text-left md:text-right">
	            <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">Last updated</div>
	            <div class="mt-1 font-mono text-xs text-tn-on-surface">{{ lastUpdatedText }}</div>
	          </div>
	        </div>
	      </section>

	      <section class="mt-10">
	        <div v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">
	          Loading…
	        </div>

	        <div v-else-if="!items.length" class="glass-panel rounded-2xl p-10 text-center">
	          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
	            <UIcon name="i-heroicons-bolt" class="h-6 w-6 text-tn-primary" />
	          </div>
	          <div class="font-headline text-base font-bold text-tn-on-surface">No briefs available yet.</div>
	          <div class="mt-1 text-sm text-tn-on-surface-variant">Check back after the next ingest + approval run.</div>
	        </div>

	        <ol v-else class="space-y-3">
	          <li
	            v-for="(item, idx) in items"
	            :key="item.id"
	            class="glass-panel group rounded-2xl border-l-4 border-l-tn-primary/60 p-5 transition-colors hover:bg-tn-surface-high/40"
	          >
	            <div class="flex gap-4">
	              <div class="w-10 shrink-0 pt-0.5 text-right font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
	                {{ String(idx + 1).padStart(2, '0') }}
	              </div>

	              <div class="min-w-0 flex-1">
	                <a
	                  class="block text-pretty text-sm font-semibold leading-relaxed text-tn-on-surface line-clamp-2 hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
	                  :href="safeHref(item.url)"
	                  target="_blank"
	                  rel="noopener noreferrer"
	                >
	                  {{ displayLine(item) }}
	                </a>

	                <div class="mt-3 flex flex-wrap items-center gap-2">
	                  <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
	                    {{ relativeTime(item) }}
	                  </span>
	
	                  <span class="h-1 w-1 rounded-full bg-white/20" />
	
	                  <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10">
	                    {{ item.source?.name ?? 'Source' }}
	                  </span>
	
	                  <template v-if="item.category?.name">
	                    <span class="h-1 w-1 rounded-full bg-white/20" />
	                    <span
	                      class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10"
	                    >
	                      {{ item.category.name }}
	                    </span>
	                  </template>
	                </div>
	              </div>
	            </div>
	          </li>
	        </ol>
	      </section>
	    </div>
	  </main>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

useSeoMeta({
  title: 'Security Briefs — ThreatNoir',
  description: 'Top security stories as punchy one-liners.',
  ogTitle: 'Security Briefs — ThreatNoir',
  ogDescription: 'Top security stories as punchy one-liners.',
  ogType: 'website'
})

type BriefItem = {
  id: string
  title: string
  brief: string | null
  url: string
  published_at: string | null
  ingested_at?: string | null
  source: { id: string; name: string; url?: string | null } | null
  category: { id: string; name: string; slug: string } | null
}

const { data, pending } = await useFetch<{ items: BriefItem[] }>('/api/briefs')

const items = computed(() => (Array.isArray(data.value?.items) ? data.value!.items : []))

const lastUpdatedAt = ref<Date | null>(null)
watchEffect(() => {
  if (data.value) lastUpdatedAt.value = new Date()
})

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return '—'
  return lastUpdatedAt.value.toLocaleString()
})

function displayLine(item: BriefItem): string {
  const b = (item.brief || '').replace(/\s+/g, ' ').trim()
  if (b) return b
  const t = (item.title || '').replace(/\s+/g, ' ').trim()
  if (t.length <= 100) return t
  const cut = t.slice(0, 100)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace >= 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function relativeTime(item: BriefItem): string {
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

  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

