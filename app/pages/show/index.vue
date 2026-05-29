<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Hero -->
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex items-center gap-3">
          <span class="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Red vs Blue Show</span>
	          <span class="h-1 w-1 rounded-full bg-white/15" />
	          <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
	            For learners
	          </span>
        </div>
        <h1 class="mt-3 font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl">
          Red vs Blue Show
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          One vulnerability. Two perspectives. Red team attacks, blue team defends. Watch the tactical breakdown.
        </p>
      </section>

      <!-- Featured Video Player -->
	      <section v-if="featured" class="mt-8">
        <div class="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          <video
            :src="featured.video_url || undefined"
            :poster="featured.thumbnail_url || undefined"
            controls
            preload="metadata"
            class="aspect-video w-full"
          />
        </div>
        <div class="mt-4">
          <h2 class="text-lg font-semibold text-tn-on-surface">{{ featured.title }}</h2>
	          <NuxtLink
	            :to="featuredHref"
	            class="mt-2 inline-flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary hover:underline hover:decoration-white/20 hover:underline-offset-4"
	          >
	            Permalink
	            <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
	          </NuxtLink>
          <p class="mt-1 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
            {{ formatDate(featured.date) }}
            <span v-if="typeof featured.duration_seconds === 'number'">· {{ formatDuration(featured.duration_seconds) }}</span>
          </p>
        </div>
      </section>

      <section v-else class="mt-8">
        <div v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">Loading episodes…</div>
        <div v-else class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">No episodes yet.</div>
      </section>

      <!-- Episode Grid -->
      <section class="mt-10">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">
          All Episodes
        </h2>
	        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	          <NuxtLink
            v-for="ep in episodes"
            :key="ep.id"
	            :to="ep.slug ? `/show/${encodeURIComponent(ep.slug)}` : '/show'"
            class="group relative overflow-hidden rounded-xl bg-tn-surface-low/70 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(76,215,246,0.10)]"
          >
            <!-- Thumbnail -->
            <div class="relative aspect-video bg-[#0a0f1a]">
              <img
                v-if="ep.thumbnail_url"
                :src="ep.thumbnail_url"
                :alt="ep.title"
                class="h-full w-full object-cover"
                loading="lazy"
              >
              <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                <UIcon name="i-heroicons-play-circle" class="h-12 w-12 text-white" />
              </div>
              <!-- Duration badge -->
              <span
                v-if="typeof ep.duration_seconds === 'number'"
                class="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                {{ formatDuration(ep.duration_seconds) }}
              </span>
            </div>

            <!-- Info -->
            <div class="p-4">
              <h3 class="line-clamp-2 text-sm font-semibold text-tn-on-surface">{{ ep.title }}</h3>
              <p class="mt-1 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ formatDate(ep.date) }}
              </p>
            </div>
	          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
	const site = useSiteConfig()

useSeoMeta({
	  title: `Red vs Blue Show — ${site.name}`,
  description: 'Red team attacks, blue team defends. Watch tactical security breakdowns of real vulnerabilities.',
	  ogTitle: `Red vs Blue Show — ${site.name}`,
  ogDescription: 'Red team attacks, blue team defends. Watch tactical security breakdowns.',
  ogType: 'website'
})

	useHead({
	  link: [
	    {
	      rel: 'alternate',
	      type: 'application/rss+xml',
		      title: `${site.name} — Red vs Blue Show`,
	      href: '/api/show/feed.xml'
	    }
	  ]
	})

type VideoBriefing = {
  id: string
	  slug: string | null
	  summary: string | null
  date: string
  title: string
  duration_seconds: number | null
  video_url: string | null
  thumbnail_url: string | null
  script: unknown
}

type EpisodesResponse = {
  items: VideoBriefing[]
  hasMore: boolean
  nextOffset: number
}

const { data, pending } = await useFetch<EpisodesResponse>('/api/show/episodes')

	const episodes = computed<VideoBriefing[]>(() => data.value?.items ?? [])
	const featured = computed(() => episodes.value[0] ?? null)

	const featuredHref = computed(() => {
	  const slug = featured.value?.slug
	  return slug ? `/show/${encodeURIComponent(slug)}` : '/show'
	})

function formatDuration(s: number): string {
  const n = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
  const m = Math.floor(n / 60)
  const sec = n % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
