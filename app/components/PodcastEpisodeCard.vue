<template>
	  <article class="glass-panel group relative rounded-2xl border-l-4 border-l-tn-primary/60 p-6 transition-colors hover:bg-tn-surface-high/40">
	    <div class="flex items-start justify-between gap-6">
	      <div class="min-w-0">
	        <div class="flex flex-wrap items-center gap-2">
	          <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/25">
	            Intelligence briefing
	          </span>
	          <span class="h-1 w-1 rounded-full bg-white/20" />
	          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ formattedDate }}</span>
	        </div>
	
	        <h2 class="mt-3 text-balance font-headline text-lg font-bold leading-snug text-tn-on-surface md:text-xl">
	          {{ episode.title }}
	        </h2>
	
	        <div class="mt-2 flex flex-wrap items-center gap-2">
	          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
	            {{ durationText || '—' }}
	          </span>
	          <span class="h-1 w-1 rounded-full bg-white/20" />
	          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
	            {{ episode.article_count }} stories
	          </span>
	        </div>
	      </div>
	
	      <button
	        type="button"
	        class="shrink-0 rounded-full bg-gradient-to-br from-tn-primary to-tn-primary-container p-3 text-black shadow-lg shadow-cyan-950/30 hover:brightness-110"
	        aria-label="Play episode"
	        @click="play"
	      >
	        <UIcon name="i-heroicons-play" class="h-5 w-5" />
	      </button>
	    </div>
	
	    <div class="relative mt-5">
	      <audio ref="audioEl" :src="episode.audio_url" controls preload="none" class="w-full tn-audio" />
	    </div>
	
	    <div class="mt-6">
	      <button
	        v-if="episode.article_count > 0"
	        type="button"
	        class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	        @click="toggleSources"
	      >
	        <UIcon :name="showSources ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4 text-tn-primary" />
	        <span>{{ showSources ? 'Hide sources' : 'Show sources' }} ({{ episode.article_count }})</span>
	      </button>
	
	      <div v-if="showSources" class="mt-4 overflow-hidden rounded-xl bg-tn-surface-lowest/50 ring-1 ring-white/10">
	        <div v-if="sourcesLoading" class="px-4 py-3 text-sm text-tn-on-surface-variant">Loading sources…</div>
	        <div v-else-if="sourcesError" class="px-4 py-3 text-sm text-red-200">Failed to load sources.</div>
	
	        <ul v-else class="divide-y divide-white/5">
	          <li v-for="a in sources" :key="a.id" class="px-4 py-3">
	            <a
	              class="block text-sm font-semibold text-tn-on-surface hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
	              :href="safeHref(a.url)"
	              target="_blank"
	              rel="noopener noreferrer"
	            >
	              {{ a.title }}
	            </a>
	            <p v-if="a.summary" class="mt-1 line-clamp-2 text-sm text-tn-on-surface-variant">
	              {{ truncateSummary(a.summary) }}
	            </p>
	          </li>
	        </ul>
	      </div>
	    </div>
	  </article>
</template>

<script setup lang="ts">
import type { PublicPodcastEpisode } from '~/types/public'
import { safeHref } from '~/composables/useSafeHref'

type PodcastSourceArticle = {
  id: string
  title: string
  summary: string | null
  url: string
}

const props = defineProps<{ episode: PublicPodcastEpisode }>()
	const audioEl = ref<HTMLAudioElement | null>(null)

const showSources = ref(false)
const sources = ref<PodcastSourceArticle[]>([])
const sourcesLoading = ref(false)
const sourcesError = ref(false)
const sourcesLoaded = ref(false)

const formattedDate = computed(() => {
  return new Date(props.episode.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const durationText = computed(() => {
  const s = props.episode.duration_seconds
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return null
  return `${Math.floor(s / 60)}m ${s % 60}s`
})

function truncateSummary(summary: string) {
  const t = summary.trim()
  if (t.length <= 100) return t
  return `${t.slice(0, 100).trim()}…`
}

async function ensureSourcesLoaded() {
  if (sourcesLoaded.value || sourcesLoading.value) return
  sourcesLoading.value = true
  sourcesError.value = false
  try {
    const res = await $fetch<{ items: PodcastSourceArticle[] }>(`/api/podcasts/${props.episode.id}/articles`)
    sources.value = Array.isArray(res.items) ? res.items : []
    sourcesLoaded.value = true
  } catch (e) {
    console.error(e)
    sourcesError.value = true
  } finally {
    sourcesLoading.value = false
  }
}

async function toggleSources() {
  showSources.value = !showSources.value
  if (showSources.value) await ensureSourcesLoaded()
}

	function play() {
	  if (!import.meta.client) return
	  try {
	    audioEl.value?.play()
	  } catch {
	    // ignore
	  }
	}
</script>

<style scoped>
.tn-audio::-webkit-media-controls-panel {
  background: rgb(17 24 39);
}
</style>
