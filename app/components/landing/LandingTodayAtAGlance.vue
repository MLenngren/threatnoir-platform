<template>
  <section class="py-12 md:py-16">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Today at a glance</p>
          <h2 class="mt-2 text-balance font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">
            The latest across ThreatNoir
          </h2>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <!-- Podcast -->
        <div class="glass-panel group overflow-hidden rounded-2xl p-5 ring-1 ring-white/10 md:p-6">
          <div class="flex items-center justify-between gap-4">
            <h3 class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Podcast</h3>
            <NuxtLink to="/podcast" class="text-xs text-tn-primary hover:underline">See all →</NuxtLink>
          </div>

          <div class="mt-4 flex items-start gap-4">
            <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-tn-surface-high ring-1 ring-white/10">
              <img src="/podcast-artwork.jpg" alt="" class="h-full w-full object-cover opacity-80" loading="lazy">
              <NuxtLink
                to="/podcast"
                class="absolute inset-0 grid place-items-center text-black"
                aria-label="Open podcast"
              >
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-tn-primary/90 shadow-[0_0_20px_rgba(76,215,246,0.20)] transition-transform group-hover:scale-105">
                  <UIcon name="i-heroicons-play" class="h-4 w-4" />
                </span>
              </NuxtLink>
            </div>

            <div class="min-w-0">
              <NuxtLink
                to="/podcast"
                class="block text-pretty text-sm font-semibold leading-snug text-tn-on-surface hover:text-tn-primary"
              >
                {{ podcastTitle }}
              </NuxtLink>
              <div class="mt-2 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ podcastDateLabel }}
              </div>
            </div>
          </div>
        </div>

        <!-- Focus -->
        <div class="glass-panel group overflow-hidden rounded-2xl p-5 ring-1 ring-white/10 md:p-6">
          <div class="flex items-center justify-between gap-4">
            <h3 class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Focus alert</h3>
            <NuxtLink to="/focus" class="text-xs text-tn-primary hover:underline">See all →</NuxtLink>
          </div>

          <div class="mt-4">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                :class="severityBadgeClass(focusSeverity)"
              >
                {{ focusSeverityLabel }}
              </span>
              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ focusDateLabel }}</span>
            </div>

            <NuxtLink
              :to="focusHref"
              class="mt-2 block text-pretty text-sm font-semibold leading-snug text-tn-on-surface hover:text-tn-primary"
            >
              {{ focusTitle }}
            </NuxtLink>
          </div>
        </div>

        <!-- Weekly -->
        <div class="glass-panel group overflow-hidden rounded-2xl p-5 ring-1 ring-white/10 md:p-6">
          <div class="flex items-center justify-between gap-4">
            <h3 class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Weekly brief</h3>
            <NuxtLink to="/weekly" class="text-xs text-tn-primary hover:underline">See all →</NuxtLink>
          </div>

          <div class="mt-4">
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
              {{ weeklyLabel }}
            </div>
            <NuxtLink
              :to="weeklyHref"
              class="mt-2 block text-pretty text-sm font-semibold leading-snug text-tn-on-surface hover:text-tn-primary"
            >
              {{ weeklyTitle }}
            </NuxtLink>
            <p v-if="weeklySummary" class="mt-2 line-clamp-2 text-sm leading-relaxed text-tn-on-surface-variant">
              {{ weeklySummary }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type PublicPodcastEpisode = {
  id: string
  date: string
  title: string
  audio_url: string | null
  duration_seconds: number | null
  article_count: number | null
  created_at: string
}

type PodcastsResponse = {
  items: PublicPodcastEpisode[]
  nextOffset: number
  hasMore: boolean
}

type FocusSeverity = 'critical' | 'high' | 'medium'

type FocusItem = {
  id: string
  title: string
  slug: string
  severity: FocusSeverity
  created_at: string
}

type WeeklyRoundupItem = {
  id: string
  week_label: string
  slug: string
  tldr: string | null
  date_from: string
  date_to: string
  published_at: string | null
  created_at: string
}

type WeeklyResponse = { items: WeeklyRoundupItem[] }

const { data: podcastsData } = await useFetch<PodcastsResponse>('/api/podcasts', {
  query: { limit: 1, offset: 0 },
  key: 'today-at-a-glance:podcast'
})

const { data: focusData } = await useFetch<{ items: FocusItem[] }>('/api/focus', {
  key: 'today-at-a-glance:focus'
})

const { data: weeklyData } = await useFetch<WeeklyResponse>('/api/weekly', {
  query: { limit: 1, offset: 0 },
  key: 'today-at-a-glance:weekly'
})

const podcast = computed(() => {
  const items = podcastsData.value?.items
  return Array.isArray(items) && items.length ? items[0] : null
})

const focus = computed(() => {
  const items = focusData.value?.items
  return Array.isArray(items) && items.length ? items[0] : null
})

const weekly = computed(() => {
  const items = weeklyData.value?.items
  return Array.isArray(items) && items.length ? items[0] : null
})

const podcastTitle = computed(() => podcast.value?.title || 'Today’s briefing')
const podcastDateLabel = computed(() => formatDateLong(podcast.value?.date || podcast.value?.created_at))

const focusTitle = computed(() => focus.value?.title || 'No active focus alert')
const focusSeverity = computed<FocusSeverity>(() => focus.value?.severity || 'medium')
const focusSeverityLabel = computed(() => (focus.value?.severity ? focus.value.severity.toUpperCase() : 'MEDIUM'))
const focusDateLabel = computed(() => formatDateShort(focus.value?.created_at))
const focusHref = computed(() => (focus.value?.slug ? `/focus/${encodeURIComponent(focus.value.slug)}` : '/focus'))

const weeklyLabel = computed(() => weekly.value?.week_label || 'This week')
const weeklyTitle = computed(() => (weekly.value?.week_label ? `Roundup ${weekly.value.week_label}` : 'Weekly roundup'))
const weeklyHref = computed(() => (weekly.value?.slug ? `/weekly/${encodeURIComponent(weekly.value.slug)}` : '/weekly'))
const weeklySummary = computed(() => toOneLine(weekly.value?.tldr || ''))

function toOneLine(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.length <= 140 ? cleaned : cleaned.slice(0, 140).trim() + '…'
}

function formatDateLong(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return '—'
  }
}

function formatDateShort(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return '—'
  }
}

function severityBadgeClass(s: FocusSeverity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (s === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/25'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
}
</script>
