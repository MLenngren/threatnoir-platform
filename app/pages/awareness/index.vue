<template>
  <main class="grid-bg py-10 md:py-14">
    <div class="mx-auto max-w-6xl px-6">
      <header class="glass-panel rounded-3xl p-8 md:p-10">
        <div class="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="flex items-center gap-3">
              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Awareness Lessons</span>
		              <span class="h-1 w-1 rounded-full bg-white/15" />
		              <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
		                For learners
		              </span>
            </div>

	            <h1 class="mt-4 text-balance font-headline text-5xl font-black tracking-tight text-tn-on-surface md:text-6xl">
	              Awareness <span class="text-tn-primary">Lessons</span>
	            </h1>

            <p class="mt-4 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
              Daily root-cause lessons extracted from real incidents—designed to scan fast and apply immediately.
            </p>
          </div>

          <div class="flex items-center gap-6">
            <div class="text-right">
              <div class="font-headline text-3xl font-black text-tn-on-surface">{{ lessons.length }}</div>
              <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">Loaded</div>
            </div>
          </div>
        </div>

        <div class="mt-8">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition border-l-2 border-transparent"
              :class="
                selectedTag
                  ? 'bg-tn-surface-lowest/40 text-tn-on-surface-variant hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface'
                  : 'bg-tn-primary/10 text-tn-primary'
              "
              :style="tagFilterStyle(null, !selectedTag)"
              @click="selectTag(null)"
            >
              <span>All</span>
            </button>

            <button
              v-for="t in tags"
              :key="t.slug"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition border-l-2 border-transparent"
              :class="
                selectedTag === t.slug
                  ? 'bg-tn-primary/10 text-tn-primary'
                  : 'bg-tn-surface-lowest/40 text-tn-on-surface-variant hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface'
              "
              :style="tagFilterStyle(t.color, selectedTag === t.slug)"
              @click="selectTag(t.slug)"
            >
              <span>{{ t.name }}</span>
              <span class="opacity-60">{{ t.lesson_count }}</span>
            </button>
          </div>

          <div v-if="tagsPending" class="mt-3 text-sm text-tn-on-surface-variant">Loading tags…</div>
        </div>
      </header>

      <section class="mt-10">
        <div v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">Loading…</div>

        <div v-else-if="lessons.length === 0" class="glass-panel rounded-2xl p-10 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
            <UIcon name="i-heroicons-light-bulb" class="h-6 w-6 text-tn-primary" />
          </div>
          <div class="font-headline text-base font-bold text-tn-on-surface">No lessons yet.</div>
          <div class="mt-1 text-sm text-tn-on-surface-variant">Check back after the next generation and approval run.</div>
        </div>

        <div v-else class="space-y-6">
          <AwarenessLessonCard v-for="l in lessons" :key="l.id" :lesson="l" />
        </div>

        <div class="mt-10 flex items-center justify-center">
          <button
            v-if="hasMore"
            type="button"
            class="rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import AwarenessLessonCard from '~/components/AwarenessLessonCard.vue'
import { useAwarenessLessons, useAwarenessTags } from '~/composables/useAwareness'

	const site = useSiteConfig()

useSeoMeta({
	  title: `Security Awareness Lessons | ${site.name}`,
  description: 'Root-cause takeaways from real security incidents. Learn what to look for in your own environment before it happens to you. Updated weekly.',
	  ogTitle: `Security Awareness Lessons | ${site.name}`,
  ogDescription: 'Root-cause takeaways from real security incidents. Learn what to look for in your own environment before it happens to you. Updated weekly.',
	  ogImage: site.ogImageUrl,
	  ogUrl: `${site.url}/awareness`,
  ogType: 'website',
  twitterCard: 'summary_large_image',
	  twitterTitle: `Security Awareness Lessons | ${site.name}`,
  twitterDescription: 'Root-cause takeaways from real security incidents. Learn what to look for in your own environment before it happens to you. Updated weekly.',
	  twitterImage: site.ogImageUrl,
	  author: site.name
})

const route = useRoute()
const router = useRouter()

const selectedTag = ref<string | null>(typeof route.query.tag === 'string' ? route.query.tag : null)
watch(
  () => route.query.tag,
  (v) => {
    selectedTag.value = typeof v === 'string' ? v : null
  }
)

function selectTag(slug: string | null) {
  selectedTag.value = slug
  router.replace({
    query: {
      ...route.query,
      tag: slug || undefined
    }
  })
}

function tagFilterStyle(color: string | null, active: boolean) {
  const accent = color || 'rgba(76, 215, 246, 0.7)'
  return {
    borderLeftColor: active ? accent : 'transparent'
  } as Record<string, string>
}

const { data: tagsData, pending: tagsPending } = useAwarenessTags()
const tags = computed(() => tagsData.value?.items ?? [])

const { lessons, pending, hasMore, loadMore, loadingMore } = useAwarenessLessons({
  tag: selectedTag,
  pageSize: 18
})
</script>
