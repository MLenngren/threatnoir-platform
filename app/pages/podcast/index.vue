<template>
  <main class="grid-bg py-10 md:py-14">
    <JsonLd :data="structuredData" />
    <div class="mx-auto max-w-7xl px-6">
      <!-- Hero (no glass wrapper) -->
      <header class="mb-16 md:mb-20">
        <div class="mb-6 flex items-center gap-3">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-tn-primary opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-tn-primary" />
          </span>
          <span class="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-tn-primary">Live Global Ops</span>
	          <span class="h-1 w-1 rounded-full bg-white/15" />
		          <span class="inline-flex items-center rounded-full bg-tn-surface-high/70 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
		            For SOC analysts · For learners
		          </span>
        </div>

        <div class="grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <div class="lg:col-span-8">
            <h1 class="mb-6 font-headline text-5xl font-black leading-[0.95] tracking-tighter text-tn-on-surface md:text-7xl">
              THE <span class="text-tn-primary">INTELLIGENCE</span><br>
              BRIEFING
            </h1>
            <p class="max-w-2xl text-base leading-relaxed text-tn-on-surface-variant md:text-lg">
              A tactical deep dive into the shadow economy of global cyber warfare—deconstructing state tradecraft and emerging threat vectors.
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end">
            <button
              type="button"
              class="group inline-flex items-center justify-center gap-3 rounded-xl bg-tn-surface-high/80 px-6 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 transition-colors hover:bg-tn-primary/5 hover:text-tn-primary"
              @click="copyRssLink"
            >
              <UIcon name="i-heroicons-rss" class="h-4 w-4 text-tn-primary transition-transform group-hover:scale-110" />
              Copy RSS Link
            </button>

            <a
              href="https://open.spotify.com/show/7BOABAMyjIF0YEvNiJpvbd"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-flex items-center justify-center gap-3 rounded-xl bg-tn-surface-high/80 px-6 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 transition-colors hover:bg-[#1DB954]/10 hover:text-[#1DB954]"
            >
              <svg class="h-4 w-4 text-[#1DB954] transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Spotify
            </a>

            <a
              href="https://www.youtube.com/playlist?list=PLyjcdGU9nPQQK6ZocOuTdtkC626Jk6L2G"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-flex items-center justify-center gap-3 rounded-xl bg-tn-surface-high/80 px-6 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 transition-colors hover:bg-[#FF0000]/10 hover:text-[#FF0000]"
            >
              <svg class="h-4 w-4 text-[#FF0000] transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube
            </a>

            <NuxtLink
              to="/podcast/archive"
              class="group inline-flex items-center justify-center gap-3 rounded-xl bg-tn-surface-high/80 px-6 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 transition-colors hover:bg-tn-primary/5 hover:text-tn-primary"
            >
              <UIcon name="i-heroicons-archive-box" class="h-4 w-4 text-tn-primary transition-transform group-hover:scale-110" />
              Historical Archive
            </NuxtLink>
          </div>
        </div>
      </header>

	      <Transition
	        enter-active-class="transition ease-out duration-200"
	        enter-from-class="opacity-0 -translate-y-1"
	        enter-to-class="opacity-100 translate-y-0"
	        leave-active-class="transition ease-in duration-150"
	        leave-from-class="opacity-100 translate-y-0"
	        leave-to-class="opacity-0 -translate-y-1"
	      >
	        <div
	          v-if="nowPlayingEpisode"
	          class="sticky top-24 z-40 mb-10 rounded-2xl bg-tn-surface-high/75 p-4 shadow-lg shadow-black/30 backdrop-blur ring-1 ring-white/10"
	          role="status"
	          aria-live="polite"
	        >
	          <div class="flex items-center justify-between gap-4">
	            <div class="min-w-0">
	              <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Now playing</div>
	              <div class="mt-1 truncate text-sm font-semibold text-tn-on-surface">{{ nowPlayingEpisode.title }}</div>
	            </div>
	            <button
	              type="button"
	              class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-white/10"
	              aria-label="Pause"
	              @click="pauseNowPlaying"
	            >
	              <UIcon name="i-heroicons-pause" class="h-4 w-4" />
	              Pause
	            </button>
	          </div>
	        </div>
	      </Transition>

      <!-- Featured episode -->
      <section v-if="featured" class="mb-20 md:mb-24">
        <div class="group overflow-hidden rounded-2xl bg-tn-surface-low shadow-2xl shadow-black/30 ring-1 ring-white/10">
          <div class="grid grid-cols-1 lg:grid-cols-2">
            <div class="relative min-h-[320px] overflow-hidden bg-tn-surface-lowest" :style="artworkStyle(featured)">
              <div class="absolute inset-0 bg-gradient-to-t from-tn-surface-low via-transparent to-transparent" />
              <div class="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  class="flex h-24 w-24 items-center justify-center rounded-full text-black shadow-[0_0_50px_rgba(76,215,246,0.35)] transition-all duration-300 hover:scale-110 active:scale-95"
                  :class="isEpisodePlaying(featured.audio_url) ? 'bg-white/90 animate-pulse' : 'bg-tn-primary'"
	                  :title="isEpisodePlaying(featured.audio_url) ? 'Pause episode' : 'Play episode'"
                  :aria-label="isEpisodePlaying(featured.audio_url) ? `Pause: ${featured.title}` : `Play: ${featured.title}`"
                  @click="toggleEpisode(featured.audio_url)"
                >
                  <UIcon :name="isEpisodePlaying(featured.audio_url) ? 'i-heroicons-pause' : 'i-heroicons-play'" class="h-12 w-12" />
                </button>
              </div>
            </div>

            <div class="flex flex-col justify-center p-7 md:p-10">
              <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span class="rounded bg-tn-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/25">
                  Latest Transmission
                </span>
                <span v-if="formatDurationClock(featured.duration_seconds)" class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                  {{ formatDurationClock(featured.duration_seconds) }} Duration
                </span>
              </div>

              <h2 class="text-balance font-headline text-3xl font-black leading-tight tracking-tighter text-tn-on-surface md:text-5xl">
                {{ featured.title }}
              </h2>

	              <NuxtLink
	                :to="showNotesHref(featured)"
	                class="mt-3 inline-flex items-center gap-2 text-xs text-tn-on-surface-variant hover:text-tn-primary"
	              >
	                Show notes →
	              </NuxtLink>

              <!-- Decorative waveform (SSR-safe, deterministic) -->
              <div class="mt-8 flex h-12 items-end gap-[2px] rounded-lg bg-tn-surface-lowest/70 px-2 ring-1 ring-white/5">
                <div
                  v-for="(h, i) in featuredWaveform"
                  :key="i"
                  class="w-[3px] rounded-sm bg-tn-primary/90"
                  :style="{ height: `${h}px` }"
                />
              </div>

	              <div v-if="featured.audio_url" class="mt-6 rounded-xl bg-[#161c28] p-4 ring-1 ring-[#1e293b]">
	                <div class="flex flex-wrap items-center gap-3">
	                  <div
	                    class="relative h-2 min-w-[180px] flex-1 cursor-pointer overflow-hidden rounded-full bg-[#1e293b]"
	                    role="slider"
	                    aria-label="Episode progress"
	                    :aria-valuenow="Math.round(episodeProgress(featured) * 100)"
	                    aria-valuemin="0"
	                    aria-valuemax="100"
	                    tabindex="0"
	                    @pointerdown.prevent.stop="seekFromEvent(featured, $event)"
	                  >
	                    <div
	                      class="h-full rounded-full bg-[#4cd7f6] transition-[width] duration-150 ease-linear"
	                      :style="{ width: `${Math.max(0, Math.min(100, episodeProgress(featured) * 100))}%` }"
	                    />
	                  </div>
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] tabular-nums">
	                    {{ episodeTimeLabel(featured) }}
	                  </div>
	                </div>
	              </div>

              <div class="mt-8 flex flex-wrap gap-x-4 gap-y-2">
                <span v-for="t in hashTags(featured)" :key="t" class="font-label text-xs text-tn-on-surface-variant">#{{ t }}</span>
              </div>

              <div class="mt-8 flex items-center gap-6">
                <NuxtLink
                  :to="showNotesHref(featured)"
                  class="font-label text-xs font-bold uppercase tracking-widest text-tn-primary hover:underline hover:decoration-white/20 hover:underline-offset-4"
                >
                  Read show notes
                </NuxtLink>

                <button
                  type="button"
                  class="rounded-lg p-2 text-tn-on-surface-variant transition-colors hover:bg-white/5 hover:text-tn-on-surface"
                  aria-label="Copy show-notes link"
                  @click="copyEpisodeLink(featured)"
                >
                  <UIcon name="i-heroicons-link" class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Episode grid -->
      <section>
        <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Recent episodes</div>
            <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">Latest briefings</h2>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="ep in gridEpisodes"
            :key="ep.id"
            class="group flex h-full flex-col overflow-hidden rounded-xl bg-tn-surface-low ring-1 ring-white/10 transition-all duration-300 hover:ring-tn-primary/30"
          >
            <div class="relative h-36 overflow-hidden bg-tn-surface-lowest" :style="artworkStyle(ep)">
              <div class="absolute inset-0 bg-gradient-to-t from-tn-surface-low via-transparent to-transparent" />
              <button
                type="button"
                class="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full text-black shadow-lg transition-all duration-300 active:scale-95"
                :class="[
                  isEpisodePlaying(ep.audio_url)
                    ? 'bg-white/90 opacity-100 translate-y-0 animate-pulse'
                    : 'bg-tn-primary/90 opacity-100 translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'
                ]"
	                :title="isEpisodePlaying(ep.audio_url) ? 'Pause episode' : 'Play episode'"
                :aria-label="isEpisodePlaying(ep.audio_url) ? `Pause: ${ep.title}` : `Play: ${ep.title}`"
                @click.prevent.stop="toggleEpisode(ep.audio_url)"
              >
                <UIcon :name="isEpisodePlaying(ep.audio_url) ? 'i-heroicons-pause' : 'i-heroicons-play'" class="h-6 w-6" />
              </button>
            </div>

            <div class="flex flex-1 flex-col p-5">
              <div class="mb-3 flex items-center justify-between gap-4">
                <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                  {{ formatDateShort(ep.date) }}
                </span>
                <span v-if="formatDurationMinutes(ep.duration_seconds)" class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
                  {{ formatDurationMinutes(ep.duration_seconds) }}
                </span>
              </div>

              <NuxtLink
                :to="showNotesHref(ep)"
                class="text-balance font-headline text-xl font-bold leading-tight text-tn-on-surface transition-colors group-hover:text-tn-primary"
              >
                {{ ep.title }}
              </NuxtLink>

	              <NuxtLink
	                :to="showNotesHref(ep)"
	                class="mt-2 inline-flex items-center gap-2 text-xs text-tn-on-surface-variant hover:text-tn-primary"
	              >
	                Show notes →
	              </NuxtLink>

	              <p v-if="episodeSnippet(ep)" class="mt-3 line-clamp-2 text-sm text-tn-on-surface-variant">
                {{ episodeSnippet(ep) }}
              </p>

	              <div v-if="ep.audio_url" class="mt-5 rounded-xl bg-[#161c28] p-3 ring-1 ring-[#1e293b]">
	                <div class="flex flex-wrap items-center gap-3">
	                  <div
	                    class="relative h-2 min-w-[160px] flex-1 cursor-pointer overflow-hidden rounded-full bg-[#1e293b]"
	                    role="slider"
	                    aria-label="Episode progress"
	                    :aria-valuenow="Math.round(episodeProgress(ep) * 100)"
	                    aria-valuemin="0"
	                    aria-valuemax="100"
	                    tabindex="0"
	                    @pointerdown.prevent.stop="seekFromEvent(ep, $event)"
	                  >
	                    <div
	                      class="h-full rounded-full bg-[#4cd7f6] transition-[width] duration-150 ease-linear"
	                      :style="{ width: `${Math.max(0, Math.min(100, episodeProgress(ep) * 100))}%` }"
	                    />
	                  </div>
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] tabular-nums">
	                    {{ episodeTimeLabel(ep) }}
	                  </div>
	                </div>
	              </div>

              <div class="mt-auto flex items-center justify-between gap-4 border-t border-white/5 pt-5">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="t in pillTags(ep)"
                    :key="t"
                    class="rounded bg-tn-surface-high/60 px-2 py-0.5 font-label text-[9px] uppercase tracking-widest text-tn-on-surface-variant"
                  >
                    #{{ t }}
                  </span>
                </div>

                <button
                  type="button"
                  class="rounded-lg p-2 text-tn-on-surface-variant transition-colors hover:bg-white/5 hover:text-tn-on-surface"
                  aria-label="Copy show-notes link"
                  @click.prevent.stop="copyEpisodeLink(ep)"
                >
                  <UIcon name="i-heroicons-link" class="h-5 w-5" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="pending" class="py-10 text-center text-tn-on-surface-variant">Loading episodes…</div>
        <div v-else-if="episodes.length === 0" class="py-10 text-center text-tn-on-surface-variant">No episodes yet.</div>
      </section>

	      <!-- Hidden audio element: custom UI above drives playback -->
	      <audio ref="audioEl" class="hidden" preload="none" playsinline />
    </div>
  </main>
</template>

<script setup lang="ts">
		import JsonLd from '~/components/seo/JsonLd.vue'
		import { useToast } from '~/composables/useToast'

type PodcastEpisodeRow = {
  id: string
  date: string
  edition: string
  title: string
  article_text: string | null
  audio_url: string | null
  duration_seconds: number | null
  article_count: number | null
  created_at: string
}

const RSS_URL = 'https://threatnoir.com/api/podcast/feed.xml'

	const structuredData = computed(() => usePodcastSeriesSchema())

const route = useRoute()
const weekQuery = computed(() => {
  const v = route.query.week
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
})

// Backward compatibility: old weekly view used /podcast?week=YYYY-MM-DD
if (weekQuery.value) {
  await navigateTo(
    {
      path: '/podcast/archive',
      query: { week: weekQuery.value }
    },
    { replace: true, redirectCode: 302 }
  )
}

useSeoMeta({
  title: 'Podcast — ThreatNoir',
  description: 'A tactical daily security briefing with audio episodes and show notes.',
  ogTitle: 'Podcast — ThreatNoir',
  ogDescription: 'A tactical daily security briefing with audio episodes and show notes.',
  ogType: 'website'
})

useHead({
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'ThreatNoir Podcast',
      href: '/api/podcast/feed.xml'
    }
  ]
})

const supabase = useSupabaseClient()
	const nuxtApp = useNuxtApp()
	const trackEvent = (nuxtApp as {
		$trackEvent?: (type: string, metadata?: Record<string, unknown>) => Promise<void>
	}).$trackEvent
		const toast = useToast()

const { data: episodesData, pending } = await useAsyncData('podcast-episodes', async () => {
  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('id,date,edition,title,article_text,audio_url,duration_seconds,article_count,created_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(7)

  if (error) {
    console.error('[podcast/index] Supabase error:', error.message)
    return []
  }
  return (data ?? []) as PodcastEpisodeRow[]
})

const episodes = computed<PodcastEpisodeRow[]>(() => (Array.isArray(episodesData.value) ? episodesData.value : []))
const featured = computed(() => episodes.value[0] ?? null)
const gridEpisodes = computed(() => episodes.value.slice(1, 7))

	const audioEl = ref<HTMLAudioElement | null>(null)
	const activeUrl = ref<string | null>(null)
	const isPlaying = ref(false)
	const currentTimeSeconds = ref(0)
	const durationSeconds = ref(0)
	const pendingSeekFraction = ref<number | null>(null)

		const activeEpisode = computed(() => {
			const src = activeUrl.value
			if (!src) return null
			return episodes.value.find((ep) => normalizedAudioUrl(ep.audio_url) === src) ?? null
		})

		const nowPlayingEpisode = computed(() => (isPlaying.value ? activeEpisode.value : null))

		function pauseNowPlaying() {
			const el = audioEl.value
			if (!el) return
			try {
				el.pause()
			} catch {
				// ignore
			}
		}

const featuredWaveform = computed(() => {
  const ep = featured.value
  if (!ep) return []
  return makeWaveformHeights(ep.id, 30)
})

function showNotesHref(ep: PodcastEpisodeRow) {
  const date = String(ep.date || '').trim()
  const edition = String(ep.edition || '').trim()
  if (!date || !edition) return '/review'
  return `/review/${encodeURIComponent(date)}/${encodeURIComponent(edition)}`
}

function editionTag(edition: string) {
  const e = (edition || '').trim().toLowerCase()
  if (e === 'morning') return 'MORNING'
  if (e === 'afternoon') return 'AFTERNOON'
  return 'BRIEFING'
}

function hashTags(ep: PodcastEpisodeRow) {
  const tags: string[] = ['INTELLIGENCE']
  tags.push(editionTag(ep.edition))
  if (typeof ep.article_count === 'number' && Number.isFinite(ep.article_count)) {
    tags.push(`STORIES_${Math.max(0, Math.floor(ep.article_count))}`)
  }
  return tags
}

function pillTags(ep: PodcastEpisodeRow) {
  const tags: string[] = [editionTag(ep.edition)]
  if (typeof ep.article_count === 'number' && Number.isFinite(ep.article_count)) {
    tags.push(`${Math.max(0, Math.floor(ep.article_count))}_STORIES`)
  }
  return tags
}

function formatDateShort(date: string) {
  try {
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    return d
      .toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      })
      .toUpperCase()
  } catch {
    return ''
  }
}

function formatDurationClock(seconds: number | null) {
  const n = typeof seconds === 'number' ? seconds : Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return null
  const m = Math.floor(n / 60)
  const s = Math.floor(n % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDurationMinutes(seconds: number | null) {
  const n = typeof seconds === 'number' ? seconds : Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${Math.max(1, Math.round(n / 60))} MIN`
}

function episodeSnippet(ep: PodcastEpisodeRow) {
  const raw = (ep.article_text || '')
    .replace(/```[^`]*```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#_*`>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return raw.slice(0, 140) || ''
}

function accentColor(ep: PodcastEpisodeRow) {
  const edition = (ep.edition || '').trim().toLowerCase()
  if (edition === 'afternoon') return 'rgba(137, 206, 255, 0.18)'
  return 'rgba(76, 215, 246, 0.18)'
}

function artworkStyle(ep: PodcastEpisodeRow) {
  const a = accentColor(ep)
  return {
    backgroundImage: `radial-gradient(circle at 30% 30%, ${a} 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.12) 0%, transparent 55%)`
  } as Record<string, string>
}

	function clamp01(n: number) {
	  if (!Number.isFinite(n)) return 0
	  return Math.max(0, Math.min(1, n))
	}

	function formatTime(s: number): string {
	  const n = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
	  const m = Math.floor(n / 60)
	  const sec = n % 60
	  return `${m}:${String(sec).padStart(2, '0')}`
	}

	function normalizedAudioUrl(url: string | null): string {
	  return String(url || '').trim()
	}

	function isEpisodeActive(url: string | null): boolean {
	  const src = normalizedAudioUrl(url)
	  return !!src && src === activeUrl.value
	}

	function episodeTotalSeconds(ep: PodcastEpisodeRow): number {
	  if (isEpisodeActive(ep.audio_url)) {
	    if (durationSeconds.value > 0) return durationSeconds.value
	  }
	  const fallback = typeof ep.duration_seconds === 'number' ? ep.duration_seconds : Number(ep.duration_seconds)
	  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
	}

	function episodeCurrentSeconds(ep: PodcastEpisodeRow): number {
	  if (!isEpisodeActive(ep.audio_url)) return 0
	  return currentTimeSeconds.value > 0 ? currentTimeSeconds.value : 0
	}

	function episodeProgress(ep: PodcastEpisodeRow): number {
	  const total = episodeTotalSeconds(ep)
	  if (total <= 0) return 0
	  return clamp01(episodeCurrentSeconds(ep) / total)
	}

	function episodeTimeLabel(ep: PodcastEpisodeRow): string {
	  return `${formatTime(episodeCurrentSeconds(ep))} / ${formatTime(episodeTotalSeconds(ep))}`
	}

	function syncFromAudio() {
	  const el = audioEl.value
	  if (!el) return
	
	  const dur = Number.isFinite(el.duration) ? el.duration : 0
	  durationSeconds.value = dur > 0 ? dur : 0
	  currentTimeSeconds.value = Number.isFinite(el.currentTime) ? el.currentTime : 0
	  isPlaying.value = !el.paused && !el.ended
	  if (el.ended && durationSeconds.value > 0) currentTimeSeconds.value = durationSeconds.value
	
	  if (pendingSeekFraction.value !== null && durationSeconds.value > 0) {
	    const next = durationSeconds.value * clamp01(pendingSeekFraction.value)
	    pendingSeekFraction.value = null
	    try {
	      el.currentTime = next
	    } catch {
	      // ignore
	    }
	  }
	}

	watch(
	  audioEl,
	  (el, prev) => {
	    if (!import.meta.client) return
	
	    if (prev) {
	      prev.removeEventListener('timeupdate', syncFromAudio)
	      prev.removeEventListener('loadedmetadata', syncFromAudio)
	      prev.removeEventListener('durationchange', syncFromAudio)
	      prev.removeEventListener('pause', syncFromAudio)
	      prev.removeEventListener('play', syncFromAudio)
	      prev.removeEventListener('ended', syncFromAudio)
	    }
	
	    if (!el) return
	
	    el.addEventListener('timeupdate', syncFromAudio)
	    el.addEventListener('loadedmetadata', syncFromAudio)
	    el.addEventListener('durationchange', syncFromAudio)
	    el.addEventListener('pause', syncFromAudio)
	    el.addEventListener('play', syncFromAudio)
	    el.addEventListener('ended', syncFromAudio)
	
	  },
	  { immediate: true }
	)

	onBeforeUnmount(() => {
	  const el = audioEl.value
	  if (!el) return
	  try {
	    el.pause()
	  } catch {
	    // ignore
	  }
	})

	async function toggleEpisode(url: string | null) {
	  if (!import.meta.client) return
	  const el = audioEl.value
	  if (!el) return
	
	  const src = normalizedAudioUrl(url)
	  if (!src) return

	  // Same episode: toggle pause/play
	  if (activeUrl.value === src) {
	    if (el.paused) {
		      await el.play().catch(() => {})
		      void trackEvent?.('podcast_play', { audio_url: src })
	    } else {
	      el.pause()
	    }
	    return
	  }

	  // New episode
	  pendingSeekFraction.value = null
	  currentTimeSeconds.value = 0
	  durationSeconds.value = 0
	
	  try {
	    el.pause()
	  } catch {
	    // ignore
	  }

	  activeUrl.value = src
	  try {
	    el.src = src
	    el.load()
		    await el.play()
		    void trackEvent?.('podcast_play', { audio_url: src })
	  } catch {
	    isPlaying.value = false
	  }
	}

	function seekFromEvent(ep: PodcastEpisodeRow, e: PointerEvent) {
	  if (!import.meta.client) return
	  const el = audioEl.value
	  if (!el) return
	
	  const src = normalizedAudioUrl(ep.audio_url)
	  if (!src) return
	
	  const target = e.currentTarget as HTMLElement | null
	  if (!target) return
	
	  const rect = target.getBoundingClientRect()
	  const x = e.clientX - rect.left
	  const frac = rect.width > 0 ? clamp01(x / rect.width) : 0

	  // If seeking a different episode, load + start playback at that position.
	  if (activeUrl.value !== src) {
	    pendingSeekFraction.value = frac
	    currentTimeSeconds.value = 0
	    durationSeconds.value = 0
	    activeUrl.value = src
	    try {
	      el.pause()
	    } catch {
	      // ignore
	    }
	    try {
	      el.src = src
	      el.load()
	      void el.play()
	    } catch {
	      // ignore
	    }
	    return
	  }

	  // Same episode
	  const total = episodeTotalSeconds(ep)
	  if (total > 0) {
	    try {
	      el.currentTime = total * frac
	    } catch {
	      // ignore
	    }
	    return
	  }

	  pendingSeekFraction.value = frac
	}

	function isEpisodePlaying(url: string | null): boolean {
	  const src = normalizedAudioUrl(url)
	  return isPlaying.value && !!src && src === activeUrl.value
	}

async function copyRssLink() {
	  await copyText(RSS_URL, 'RSS link copied')
}

async function copyEpisodeLink(ep: PodcastEpisodeRow) {
  if (!import.meta.client) return
  const href = showNotesHref(ep)
  const absolute = new URL(href, window.location.origin).toString()
	  await copyText(absolute, 'Show notes link copied')
}

	async function copyText(text: string, successMessage = 'Link copied') {
  if (!import.meta.client) return
  const t = String(text || '').trim()
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
		    toast.show(successMessage)
	    return
  } catch {
	    // fall through
  }
  try {
    const el = document.createElement('textarea')
    el.value = t
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
		    toast.show(successMessage)
  } catch {
	    toast.show('Copy failed', 'error')
  }
}

function makeWaveformHeights(seed: string, bars: number) {
  const count = Math.max(1, Math.min(80, Math.floor(bars)))

  // Simple deterministic LCG (SSR-safe)
  let x = 0
  for (let i = 0; i < seed.length; i++) {
    x = (x * 31 + seed.charCodeAt(i)) >>> 0
  }

  const heights: number[] = []
  for (let i = 0; i < count; i++) {
    x = (1664525 * x + 1013904223) >>> 0
    const u = x / 0xffffffff
    const h = Math.round(8 + u * 34) // px: 8..42
    heights.push(h)
  }
  return heights
}
</script>
