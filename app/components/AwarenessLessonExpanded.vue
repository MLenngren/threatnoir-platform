<template>
  <article
    class="glass-panel mb-[30px] group relative overflow-hidden rounded-2xl p-6 text-left ring-1 ring-white/10 md:p-8 border-l-2"
    :style="accentStyle"
  >
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <div class="space-y-6 lg:col-span-8">
        <div class="flex flex-wrap items-center gap-3">
          <span class="rounded-full border border-tn-primary/20 bg-tn-primary/10 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-tn-primary">
	            Awareness Lessons
          </span>

          <div class="flex items-center gap-2 text-tn-on-surface-variant">
            <UIcon name="i-heroicons-clock" class="h-4 w-4" />
            <span class="font-label text-[10px] uppercase tracking-widest">{{ timeAgo }}</span>
          </div>
        </div>

	      <div class="flex flex-wrap gap-2">
	        <NuxtLink
	          v-for="t in tags"
	          :key="t.slug"
	          :to="`/tag/${t.slug}`"
	          class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1"
	          :style="tagRingStyle(t.color)"
	        >
	          {{ t.name }}
	        </NuxtLink>
	      </div>

	        <h2 class="text-left font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">
	          <NuxtLink
	            v-if="lesson.slug"
	            :to="`/awareness/${lesson.slug}`"
	            class="hover:text-tn-primary transition-colors"
	          >
	            {{ lesson.title }}
	          </NuxtLink>
	          <span v-else>{{ lesson.title }}</span>
	        </h2>

        <p class="whitespace-pre-line text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
          {{ (lesson.body || '').trim() }}
        </p>

        <div v-if="lesson.prevention" class="glass-panel relative overflow-hidden rounded-xl p-6 border-l-2 border-tn-primary">
          <div class="absolute right-0 top-0 p-4 opacity-10">
            <UIcon name="i-heroicons-light-bulb" class="h-16 w-16 text-tn-primary" />
          </div>

          <h4 class="mb-3 flex items-center gap-2 font-label text-xs uppercase tracking-widest text-tn-primary">
            <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
            Tactical Insight
          </h4>

          <div class="space-y-3 text-sm leading-relaxed text-tn-on-surface md:text-base">
            <template v-for="(block, i) in parsePrevention(lesson.prevention)" :key="i">
              <p v-if="block.type === 'heading'" class="font-bold text-tn-on-surface mt-2 first:mt-0">{{ block.text }}</p>
              <ul v-else-if="block.type === 'list'" class="space-y-2 pl-1">
                <li v-for="(item, j) in block.items" :key="j" class="flex gap-3">
                  <UIcon name="i-heroicons-check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-tn-primary" />
                  <span class="text-tn-on-surface-variant">{{ item }}</span>
                </li>
              </ul>
              <p v-else class="text-tn-on-surface-variant">{{ block.text }}</p>
            </template>
          </div>
        </div>
      </div>

      <aside class="space-y-6 lg:col-span-4">
        <div class="rounded-lg bg-tn-surface-low p-6 border-l-2" :style="accentStyle">
          <h5 class="mb-3 font-label text-sm font-bold uppercase text-tn-on-surface">Tags</h5>
	        <div class="flex flex-wrap gap-2">
	          <NuxtLink
	            v-for="t in tags"
	            :key="t.slug"
	            :to="`/tag/${t.slug}`"
	            class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1"
	            :style="tagRingStyle(t.color)"
	          >
	            {{ t.name }}
	          </NuxtLink>
            <span v-if="tags.length === 0" class="text-xs text-tn-on-surface-variant">—</span>
          </div>
        </div>

        <div v-if="frameworkRefs.length" class="rounded-lg bg-tn-surface-low p-6 border-l-2 border-tn-primary">
          <h5 class="mb-3 font-label text-sm font-bold uppercase text-tn-on-surface">Framework References</h5>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="ref in frameworkRefs"
              :key="ref"
              class="rounded bg-tn-primary/5 px-2 py-0.5 font-mono text-[10px] text-tn-primary"
            >
              {{ ref }}
            </span>
          </div>
        </div>

        <div class="rounded-lg border border-white/10 bg-tn-surface-lowest p-6">
          <h5 class="mb-3 font-label text-sm font-bold uppercase text-tn-on-surface">Source</h5>

          <a
            v-if="lesson.article?.url"
            :href="safeHref(lesson.article.url)"
            target="_blank"
            rel="noopener noreferrer"
            class="group inline-flex w-full items-start justify-between gap-3 text-sm text-tn-on-surface-variant hover:text-tn-primary"
            :title="lesson.article.title"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-label text-[10px] font-bold uppercase tracking-widest">Read original</span>
              <span class="mt-1 block line-clamp-2 text-xs leading-5">{{ lesson.article.title || lesson.article.url }}</span>
            </span>
            <UIcon name="i-heroicons-arrow-up-right" class="mt-0.5 h-5 w-5 shrink-0" />
          </a>
          <div v-else class="text-xs text-tn-on-surface-variant">—</div>

          <div class="mt-4 border-t border-white/10 pt-4">
            <div class="flex items-center justify-between gap-3">
              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Published</span>
              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ fullDate }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </article>
</template>

<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'

import { safeHref } from '~/composables/useSafeHref'
import type { AwarenessLesson, AwarenessTag } from '~/types/public'

const props = defineProps<{ lesson: AwarenessLesson }>()

const tags = computed(() => (Array.isArray(props.lesson.tags) ? props.lesson.tags : []))

const accentColor = computed(() => {
  const first = tags.value[0]
  return first?.color || 'rgba(76, 215, 246, 0.6)'
})

const accentStyle = computed(() => {
  return { borderLeftColor: accentColor.value }
})

function tagRingStyle(color: AwarenessTag['color']) {
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

type PreventionBlock = { type: 'heading'; text: string } | { type: 'list'; items: string[] } | { type: 'text'; text: string }

function parsePrevention(raw: string | null | undefined): PreventionBlock[] {
  const text = (raw || '').trim()
  if (!text) return []

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const blocks: PreventionBlock[] = []
  let currentList: string[] = []

  for (const line of lines) {
    // Bold heading: **Something:**
    const headingMatch = line.match(/^\*\*(.+?)\*\*:?\s*$/)
    if (headingMatch) {
      if (currentList.length) {
        blocks.push({ type: 'list', items: currentList })
        currentList = []
      }
      blocks.push({ type: 'heading', text: headingMatch[1].replace(/:$/, '') })
      continue
    }

    // Bullet point: - Something or • Something
    const bulletMatch = line.match(/^[-•*]\s+(.+)/)
    if (bulletMatch) {
      currentList.push(bulletMatch[1])
      continue
    }

    // Plain text (fallback for old unstructured prevention)
    if (currentList.length) {
      blocks.push({ type: 'list', items: currentList })
      currentList = []
    }
    blocks.push({ type: 'text', text: line })
  }

  if (currentList.length) {
    blocks.push({ type: 'list', items: currentList })
  }

  // If nothing was parsed as structured, return the whole thing as one text block
  if (blocks.length === 0 && text) {
    blocks.push({ type: 'text', text })
  }

  return blocks
}

const fullDate = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(dateValue.value)
})

const frameworkRefs = computed(() => {
  const raw = Array.isArray(props.lesson.framework_refs) ? props.lesson.framework_refs : []
  return raw.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => !!x).slice(0, 20)
})
</script>
