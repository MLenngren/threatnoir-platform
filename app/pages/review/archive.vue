<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-3">
              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Archive</span>
            </div>
            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">REVIEW ARCHIVE</h1>
            <p class="mt-3 text-sm text-tn-on-surface-variant md:text-base">Browse older weeks of published reviews.</p>
          </div>
          <NuxtLink
            to="/review"
            class="rounded-lg bg-tn-surface-lowest/60 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Back to this week
          </NuxtLink>
        </div>
      </section>

	      <section class="mt-10 space-y-3">
        <NuxtLink
          v-for="w in weeks"
          :key="w.weekStart"
          :to="`/review?week=${w.weekStart}`"
	          class="glass-panel block rounded-2xl p-5 transition-colors hover:bg-tn-surface-high/40"
        >
	          <div class="flex flex-wrap items-center justify-between gap-3">
	            <div class="font-headline text-base font-bold text-tn-on-surface">
	              {{ w.rangeText }}
	            </div>
	            <span class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/25">
	              {{ w.count }} {{ w.count === 1 ? 'review' : 'reviews' }}
	            </span>
	          </div>
        </NuxtLink>

	        <div v-if="pending" class="py-8 text-center text-tn-on-surface-variant">Loading archive…</div>
	        <div v-if="!pending && weeks.length === 0" class="py-8 text-center text-tn-on-surface-variant">No reviews yet.</div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { formatWeekRange, getWeekRangeUtc, parseIsoDateToUtcDate } from '~/composables/useWeekNav'

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

type WeekCard = {
  weekStart: string
  rangeText: string
  count: number
}

	const site = useSiteConfig()

useSeoMeta({
	  title: `Review archive — ${site.name}`,
	  description: `Browse older ${site.name} reviews by week.`,
	  ogTitle: `Review archive — ${site.name}`,
	  ogDescription: `Browse older ${site.name} reviews by week.`,
  ogType: 'website'
})

const { data, pending } = await useAsyncData('review-archive', async () => {
  const res = await $fetch<ReviewsIndexResponse>('/api/reviews')
  return Array.isArray(res.items) ? res.items : []
})

const weeks = computed<WeekCard[]>(() => {
  const items = Array.isArray(data.value) ? (data.value as ReviewIndexItem[]) : []
  const map = new Map<string, { start: Date; end: Date; count: number }>()

  for (const r of items) {
    const d = parseIsoDateToUtcDate(r.date)
    if (!d) continue
    const range = getWeekRangeUtc(d)
    const key = range.startIso
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, { start: range.start, end: range.end, count: 1 })
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([weekStart, v]) => ({
      weekStart,
      rangeText: formatWeekRange(v.start, v.end),
      count: v.count
    }))
})
</script>
