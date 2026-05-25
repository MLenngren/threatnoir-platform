<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
	        <div class="tn-reveal" :class="revealed ? 'tn-reveal--in' : ''">
	          <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Awareness Lessons</p>
	          <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
	            Awareness Lessons
	          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
            Root-cause takeaways extracted from the latest incidents—10× faster to internalize than a full write-up.
          </p>
        </div>

        <NuxtLink
          to="/awareness"
          class="tn-reveal inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: '120ms' }"
        >
          Explore lessons
        </NuxtLink>
      </div>

      <div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AwarenessLessonCard
          v-for="(l, idx) in items"
          :key="l.id"
          class="tn-reveal"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: `${180 + idx * 80}ms` }"
          :lesson="l"
          compact
        />

        <div
          v-if="!pending && items.length === 0"
          class="tn-reveal rounded-2xl bg-tn-surface-low/70 backdrop-blur-md p-6 text-sm text-tn-on-surface-variant ring-1 ring-white/10"
          :class="revealed ? 'tn-reveal--in' : ''"
        >
          No published lessons yet.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'
import type { AwarenessLesson } from '~/types/public'

import AwarenessLessonCard from '~/components/AwarenessLessonCard.vue'

type LessonsResponse = {
  items: AwarenessLesson[]
  page: number
  limit: number
  hasMore: boolean
}

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })

const { data, pending } = await useFetch<LessonsResponse>('/api/awareness', {
  query: { limit: 6, page: 1 }
})

const items = computed(() => {
  const v = data.value?.items
  return Array.isArray(v) ? v.slice(0, 3) : []
})
</script>
