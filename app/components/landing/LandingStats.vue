<template>
  <section v-if="show" class="py-6">
    <div class="mx-auto max-w-6xl px-6">
      <div
        class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-xl bg-tn-surface-low/40 px-4 py-3 ring-1 ring-white/10 backdrop-blur-md"
      >
        <span class="inline-flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-widest text-red-400">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Live
        </span>

        <NuxtLink
          v-if="articlesToday !== null"
          to="/feed"
          class="inline-flex items-center gap-1.5 font-label text-[11px] text-tn-on-surface-variant hover:text-tn-primary"
        >
          <span class="font-bold text-tn-on-surface">{{ articlesToday }}</span>
          <span>articles today</span>
        </NuxtLink>

        <NuxtLink
          v-if="podcastHoursAgo !== null"
          to="/podcast"
          class="inline-flex items-center gap-1.5 font-label text-[11px] text-tn-on-surface-variant hover:text-tn-primary"
        >
          <UIcon name="i-heroicons-microphone" class="h-3.5 w-3.5" />
          <span>Podcast</span>
          <span class="font-bold text-tn-on-surface">{{ formatPodcastAge(podcastHoursAgo) }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="activeFocus > 0"
          to="/focus"
          class="inline-flex items-center gap-1.5 font-label text-[11px] text-tn-on-surface-variant hover:text-tn-primary"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="h-3.5 w-3.5 text-red-400" />
          <span class="font-bold text-tn-on-surface">{{ activeFocus }}</span>
          <span>active {{ activeFocus === 1 ? 'advisory' : 'advisories' }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="weeklyLabel"
          :to="weeklyHref"
          class="inline-flex items-center gap-1.5 font-label text-[11px] text-tn-on-surface-variant hover:text-tn-primary"
        >
          <UIcon name="i-heroicons-calendar-days" class="h-3.5 w-3.5" />
          <span class="font-bold text-tn-on-surface">{{ weeklyLabel }}</span>
          <span>roundup</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type StatsResponse = {
  articles_today: number
  total_articles: number
  active_focus_items: number
  awareness_lessons: number
  latest_podcast: {
    hours_ago: number | null
    date: string | null
    edition: string | null
    title: string | null
  }
  latest_weekly: { week_label: string; slug: string } | null
}

const { data, error } = await useFetch<StatsResponse>('/api/stats', {
  key: 'landing-stats',
  server: true
})

const articlesToday = computed(() => (error.value ? null : (data.value?.articles_today ?? null)))
const podcastHoursAgo = computed(() => (error.value ? null : (data.value?.latest_podcast?.hours_ago ?? null)))
const activeFocus = computed(() => (error.value ? 0 : (data.value?.active_focus_items ?? 0)))
const weeklyLabel = computed(() => (error.value ? null : (data.value?.latest_weekly?.week_label ?? null)))
const weeklyHref = computed(() => {
  const slug = error.value ? null : data.value?.latest_weekly?.slug
  return slug ? `/weekly/${slug}` : '/weekly'
})

const show = computed(() => {
  return (
    articlesToday.value !== null ||
    podcastHoursAgo.value !== null ||
    activeFocus.value > 0 ||
    Boolean(weeklyLabel.value)
  )
})

function formatPodcastAge(hours: number): string {
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>
