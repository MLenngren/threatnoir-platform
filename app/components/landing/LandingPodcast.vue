<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div class="tn-reveal bg-tn-surface-low/70 backdrop-blur-md rounded-2xl ring-1 ring-white/10 p-6 md:p-10" :class="revealed ? 'tn-reveal--in' : ''">
        <div class="flex flex-col gap-10 md:flex-row md:items-center">
          <div class="w-full md:w-1/3">
            <div class="aspect-square overflow-hidden rounded-xl bg-tn-surface-high ring-1 ring-white/10 relative group">
              <img
                src="/podcast-artwork.jpg"
                alt="ThreatNoir podcast artwork"
                class="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              >
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="h-16 w-16 rounded-full bg-tn-primary/20 backdrop-blur-md ring-1 ring-tn-primary/30 flex items-center justify-center text-tn-primary">
                  <UIcon name="i-heroicons-play" class="h-7 w-7" />
                </div>
              </div>
            </div>
          </div>

          <div class="w-full md:w-2/3 min-w-0">
            <span class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
              Daily briefing player
            </span>
            <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
              {{ headingText }}
            </h2>

            <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
              <span v-if="metaText">{{ metaText }}</span>
              <span v-else>New episodes daily at 07:00 and 16:00 UTC</span>
            </div>

            <div v-if="episode?.audio_url" class="mt-8 rounded-xl bg-tn-surface-high p-5 ring-1 ring-white/10">
              <audio :src="episode.audio_url" controls preload="none" class="w-full" />
            </div>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                v-if="audioHref"
                :href="audioHref"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
              >
                Listen now
              </a>
              <NuxtLink
                to="/podcast"
                class="inline-flex items-center justify-center rounded-lg bg-tn-surface-high px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-highest"
              >
                Browse all episodes
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <div
        class="tn-reveal mt-6 rounded-2xl bg-gradient-to-br from-tn-surface-low/30 to-cyan-950/20 p-6 md:p-8 ring-1 ring-white/10"
        :class="revealed ? 'tn-reveal--in' : ''"
        :style="{ transitionDelay: '120ms' }"
      >
        <h3 class="font-headline text-xl font-bold tracking-tight text-tn-on-surface md:text-2xl">
          Extended <span class="text-tn-primary">Edition</span>
        </h3>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          A longer daily briefing with deeper coverage, additional stories, and more context for security teams.
        </p>
        <div class="mt-5">
          <NuxtLink
            to="/podcast/extended-signup"
            class="inline-flex items-center justify-center rounded-lg bg-tn-surface-high px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-primary ring-1 ring-tn-primary/20 hover:bg-tn-surface-highest"
          >
            Request access
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'
import { safeHref } from '~/composables/useSafeHref'
import type { PublicPodcastEpisode } from '~/types/public'

type PodcastsResponse = {
  items: PublicPodcastEpisode[]
  nextOffset: number
  hasMore: boolean
}

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })

const { data, error } = await useFetch<PodcastsResponse>('/api/podcasts', {
  query: { limit: 1, offset: 0 }
})

const episode = computed(() => {
  const items = data.value?.items
  return Array.isArray(items) && items.length ? items[0] : null
})

function formatDuration(seconds: number | null | undefined): string | null {
  const n = typeof seconds === 'number' ? seconds : Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return null
  const m = Math.floor(n / 60)
  const s = Math.floor(n % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const headingText = computed(() => {
  if (episode.value?.title) return episode.value.title
  if (error.value) return 'New episodes daily'
  return 'New episodes daily'
})

const metaText = computed(() => {
  if (!episode.value) return null

  const duration = formatDuration(episode.value.duration_seconds)
  const stories = typeof episode.value.article_count === 'number' ? episode.value.article_count : null
  const date = episode.value.date ? new Date(episode.value.date) : null
  const dateText = date
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const parts = [dateText, duration ? `Duration: ${duration}` : null, stories !== null ? `${stories} stories covered` : null]
    .filter((v): v is string => !!v)

  return parts.length ? parts.join(' · ') : null
})

const audioHref = computed(() => {
  const href = safeHref(episode.value?.audio_url)
  return href && href !== '#' ? href : null
})
</script>
