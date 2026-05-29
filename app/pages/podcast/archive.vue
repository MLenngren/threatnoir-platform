<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">

      <!-- Header -->
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="flex items-center gap-3">
              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Historical archive</span>
            </div>
            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
              THE INTELLIGENCE BRIEFING
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	              Browse older weeks of {{ site.name }} episodes.
            </p>

            <div class="mt-4">
              <a
                href="/api/podcast/feed.xml"
                class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:text-tn-primary"
              >
                RSS feed
              </a>
            </div>
          </div>

          <NuxtLink
            to="/podcast"
            class="rounded-lg bg-tn-surface-lowest/60 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Back to podcast landing
          </NuxtLink>
        </div>
      </section>

      <!-- Week navigation -->
      <section class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">{{ weekLabel }}</div>
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/podcast/archive?week=${prevWeek}`"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            ← Prev
          </NuxtLink>
          <NuxtLink
            :to="`/podcast/archive?week=${nextWeek}`"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Next →
          </NuxtLink>
        </div>
      </section>

      <!-- Episode list -->
      <section class="mt-10 space-y-4">
        <PodcastEpisodeCard v-for="ep in episodes" :key="ep.id" :episode="ep" />

        <div v-if="loading" class="py-8 text-center text-tn-on-surface-variant">Loading episodes…</div>

        <div v-if="!loading && episodes.length === 0" class="py-8 text-center text-tn-on-surface-variant">
          No episodes yet.
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import PodcastEpisodeCard from '~/components/PodcastEpisodeCard.vue'
import { useWeekNav } from '~/composables/useWeekNav'
import type { PublicPodcastEpisode } from '~/types/public'

	const site = useSiteConfig()

useSeoMeta({
	  title: `Podcast archive — ${site.name}`,
	  description: `Browse older ${site.name} podcast episodes by week.`,
	  ogTitle: `Podcast archive — ${site.name}`,
	  ogDescription: `Browse older ${site.name} podcast episodes by week.`,
  ogType: 'website'
})

useHead({
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
	      title: `${site.name} Podcast`,
      href: '/api/podcast/feed.xml'
    }
  ]
})

type PodcastsResponse = {
  items: PublicPodcastEpisode[]
  nextOffset: number
  hasMore: boolean
}

const { weekStartIso, weekEndIso, prevWeekIso, nextWeekIso, label } = useWeekNav()

const apiQuery = computed(() => ({
  from: weekStartIso.value,
  to: weekEndIso.value,
  limit: 50,
  offset: 0
}))

const { data, pending } = useFetch<PodcastsResponse>('/api/podcasts', {
  query: apiQuery
})

const episodes = computed(() => (Array.isArray(data.value?.items) ? data.value!.items : []))
const loading = computed(() => pending.value)
const weekLabel = computed(() => label.value)
const prevWeek = computed(() => prevWeekIso.value)
const nextWeek = computed(() => nextWeekIso.value)
</script>
