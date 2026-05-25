<template>
  <AwarenessLessonExpanded v-if="!isCompact" :lesson="lesson" />

  <article
    v-else
    class="group relative rounded-2xl bg-tn-surface-low/70 p-5 backdrop-blur-md ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-950/20 border-l-4"
    :style="accentStyle"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
	        <div class="flex flex-wrap items-center gap-2">
	          <NuxtLink
	            v-for="t in displayTags"
	            :key="t.slug"
	            :to="`/tag/${t.slug}`"
	            class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1"
	            :style="tagStyle(t.color)"
	          >
	            {{ t.name }}
	          </NuxtLink>

          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
            {{ timeAgo }}
          </span>
        </div>

	        <NuxtLink
	          v-if="lesson.slug"
	          :to="`/awareness/${lesson.slug}`"
	          class="mt-2 block text-balance text-base font-semibold leading-snug text-tn-on-surface hover:text-tn-primary transition-colors"
	        >
	          {{ lesson.title }}
	        </NuxtLink>
	        <div v-else class="mt-2 text-balance text-base font-semibold leading-snug text-tn-on-surface">
	          {{ lesson.title }}
	        </div>

      </div>

      <span
        class="shrink-0 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10"
	        title="Awareness Lessons"
      >
        Lesson
      </span>
    </div>

    <p class="mt-3 line-clamp-3 text-sm leading-6 text-tn-on-surface-variant">
      {{ (lesson.body || '').trim() }}
    </p>

    <div v-if="lesson.article?.url" class="mt-4 flex items-center justify-between gap-3">
      <a
        :href="safeHref(lesson.article.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="min-w-0 truncate font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary"
        :title="lesson.article.title"
      >
        Read original
      </a>
      <UIcon name="i-heroicons-arrow-up-right" class="h-4 w-4 text-tn-on-surface-variant" />
    </div>
  </article>
</template>

<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'

import AwarenessLessonExpanded from '~/components/AwarenessLessonExpanded.vue'

import { safeHref } from '~/composables/useSafeHref'
import type { AwarenessLesson, AwarenessTag } from '~/types/public'

const props = defineProps<{ lesson: AwarenessLesson; compact?: boolean }>()

const isCompact = computed(() => !!props.compact)

const displayTags = computed(() => {
  const tags = Array.isArray(props.lesson?.tags) ? props.lesson.tags : []
  return isCompact.value ? tags.slice(0, 2) : tags.slice(0, 3)
})

const accentColor = computed(() => {
  const first = displayTags.value[0]
  return first?.color || 'rgba(76, 215, 246, 0.6)'
})

const accentStyle = computed(() => {
  return { borderLeftColor: accentColor.value }
})

function tagStyle(color: AwarenessTag['color']) {
  const ring = color || 'rgba(255,255,255,0.12)'
  return {
    '--tw-ring-color': ring
  } as Record<string, string>
}

const dateValue = computed(() => {
  const raw = props.lesson.published_at || props.lesson.created_at
  const d = raw ? new Date(raw) : new Date()
  return Number.isNaN(d.getTime()) ? new Date() : d
})

const timeAgo = useTimeAgo(dateValue)
</script>
