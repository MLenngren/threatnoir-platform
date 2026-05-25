<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div class="tn-reveal" :class="revealed ? 'tn-reveal--in' : ''">
          <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Latest intelligence</p>
          <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
            Approved articles
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
            A live sample of what's landing in the archive right now.
          </p>
        </div>

        <NuxtLink
          to="/feed"
          class="tn-reveal inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: '120ms' }"
        >
          View all intelligence
        </NuxtLink>
      </div>

      <div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(a, idx) in items"
          :key="a.id"
          class="tn-reveal group relative overflow-hidden rounded-2xl bg-tn-surface-low/70 backdrop-blur-md ring-1 ring-white/10"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: `${180 + idx * 80}ms` }"
        >
          <div class="aspect-[16/9] overflow-hidden bg-tn-surface-high">
            <img
              :src="a.image_url || categoryFallback(a)"
              alt=""
              class="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
              @error="(e: Event) => { (e.target as HTMLImageElement).src = categoryFallback(a) }"
            >
          </div>

          <div class="p-5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full bg-tn-surface-lowest px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10">
                {{ a.category?.name ?? 'Uncategorized' }}
              </span>
              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ dateLabelFor(a) }}</span>
            </div>

            <a
              :href="safeHref(a.url)"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 block text-balance text-sm font-semibold leading-snug text-tn-on-surface transition-colors group-hover:text-tn-primary"
            >
              {{ a.title }}
            </a>

            <p class="mt-3 line-clamp-3 text-sm leading-6 text-tn-on-surface-variant">
              {{ (a.ai_summary || a.summary || '').trim() }}
            </p>

            <div class="mt-4 flex items-center justify-between gap-3">
              <div class="min-w-0 truncate font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ a.source?.name ?? 'Source' }}
              </div>
              <UIcon name="i-heroicons-arrow-up-right" class="h-4 w-4 text-tn-on-surface-variant" />
            </div>
          </div>
        </article>

        <div
          v-if="!pending && items.length === 0"
          class="tn-reveal rounded-2xl bg-tn-surface-low/70 backdrop-blur-md p-6 text-sm text-tn-on-surface-variant ring-1 ring-white/10"
          :class="revealed ? 'tn-reveal--in' : ''"
        >
          No approved articles yet.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'
import { safeHref } from '~/composables/useSafeHref'
import type { PublicArticle } from '~/types/public'

type ArticlesResponse = {
  items: PublicArticle[]
  nextOffset: number
  hasMore: boolean
}

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })

const { data, pending } = await useFetch<ArticlesResponse>('/api/articles', {
  query: { limit: 6, offset: 0 }
})

const items = computed(() => {
  const v = data.value?.items
  return Array.isArray(v) ? v : []
})

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  vulnerabilities: 'vulnerabilities',
  'zero-day': 'vulnerabilities',
  breaches: 'breaches',
  ransomware: 'ransomware',
  malware: 'malware',
  'supply-chain': 'supply-chain',
  'nation-state': 'nation-state',
  policy: 'policy',
  compliance: 'policy',
  gdpr: 'policy',
  nis2: 'policy',
}

function categoryFallback(a: PublicArticle): string {
  const slug = ((a.category as Record<string, unknown>)?.slug as string || '').toLowerCase()
  const mapped = CATEGORY_IMAGE_MAP[slug] || 'default'
  return `/images/category-${mapped}.png`
}

function dateLabelFor(a: PublicArticle): string {
  const raw = (a.published_at || a.ingested_at) as string | null | undefined
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
