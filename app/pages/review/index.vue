<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
	  <section class="glass-panel rounded-2xl p-6 md:p-8">
	    <div class="flex items-center gap-3">
	      <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	      <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Weekly reviews</span>
	    </div>
	    <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">REVIEWS</h1>
	    <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	      Podcast companion articles—published when the morning/afternoon episode is ready.
	    </p>

	    <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
		      <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">{{ weekLabel }}</div>
	      <div class="flex items-center gap-2">
	        <NuxtLink
	          :to="`/review?week=${prevWeek}`"
		          class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	        >
	          ← Prev
	        </NuxtLink>
	        <NuxtLink
	          :to="`/review?week=${nextWeek}`"
		          class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	        >
	          Next →
	        </NuxtLink>
	      </div>
	    </div>
      </section>

	      <section class="mt-10 space-y-3">
        <NuxtLink
          v-for="ep in items"
          :key="`${ep.date}-${ep.edition}`"
          :to="`/review/${ep.date}/${ep.edition}`"
	          class="glass-panel block rounded-2xl border-l-4 border-l-tn-primary/60 p-5 transition-colors hover:bg-tn-surface-high/40"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
	            <div class="flex flex-wrap items-center gap-2">
	              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ ep.date }}</span>
	              <span class="h-1 w-1 rounded-full bg-white/20" />
	              <span
	                class="inline-flex items-center rounded-full px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest ring-1"
	                :class="editionChipClass(ep.edition)"
	              >
	                {{ editionLabel(ep.edition) }}
	              </span>
	              <template v-if="typeof ep.article_count === 'number'">
	                <span class="h-1 w-1 rounded-full bg-white/20" />
	                <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ ep.article_count }} articles</span>
	              </template>
	            </div>
          </div>

	          <div class="mt-3 text-balance font-headline text-base font-bold text-tn-on-surface">
            {{ ep.title || `${ep.date} ${editionLabel(ep.edition)} review` }}
          </div>
        </NuxtLink>

	        <div v-if="pending" class="py-8 text-center text-tn-on-surface-variant">Loading reviews…</div>

	        <div v-if="!pending && items.length === 0" class="py-8 text-center text-tn-on-surface-variant">
	      No reviews for this week.
        </div>

		    <div class="mt-10 flex justify-center">
		      <NuxtLink
		        to="/review/archive"
		        class="rounded-lg bg-tn-surface-lowest/60 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
		      >
		        Archive
		      </NuxtLink>
		    </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useWeekNav } from '~/composables/useWeekNav'

type ReviewIndexItem = {
  date: string
  edition: string
  title: string | null
  article_count: number | null
  audio_url: string | null
  created_at: string
}

type ReviewsIndexResponse = {
  items: ReviewIndexItem[]
}

useSeoMeta({
  title: 'Reviews — ThreatNoir',
  description: 'Podcast companion review articles published with each ThreatNoir episode.',
  ogTitle: 'Reviews — ThreatNoir',
  ogDescription: 'Podcast companion review articles published with each ThreatNoir episode.',
  ogType: 'website'
})

const { weekStartIso, weekEndIso, prevWeekIso, nextWeekIso, label } = useWeekNav()
const apiQuery = computed(() => ({ from: weekStartIso.value, to: weekEndIso.value }))

const { data, pending } = useFetch<ReviewsIndexResponse>('/api/reviews', {
  query: apiQuery
})

const items = computed(() => (Array.isArray(data.value?.items) ? data.value!.items : []))
const weekLabel = computed(() => label.value)
const prevWeek = computed(() => prevWeekIso.value)
const nextWeek = computed(() => nextWeekIso.value)

function editionLabel(edition: string) {
  const e = (edition || '').toLowerCase()
  if (e === 'morning') return 'Morning'
  if (e === 'afternoon') return 'Afternoon'
  return edition
}

function editionChipClass(edition: string) {
  const e = (edition || '').toLowerCase()
  if (e === 'morning') return 'bg-sky-950/20 text-sky-200 ring-sky-500/25'
  if (e === 'afternoon') return 'bg-amber-950/20 text-amber-200 ring-amber-500/25'
  return 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10'
}
</script>
