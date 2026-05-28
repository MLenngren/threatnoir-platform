<template>
  <main class="grid-bg py-10 md:py-14">
    <JsonLd v-if="structuredData" :data="structuredData" />
    <div class="mx-auto max-w-6xl px-6">
      <header class="mb-6">
        <NuxtLink
          to="/weekly"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to Weekly Roundups
        </NuxtLink>
      </header>

      <section v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">
        Loading…
      </section>

      <section v-else-if="!roundup" class="glass-panel rounded-2xl p-10 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
          <UIcon name="i-heroicons-newspaper" class="h-6 w-6 text-tn-primary" />
        </div>
        <div class="font-headline text-base font-bold text-tn-on-surface">Roundup not found.</div>
        <div class="mt-1 text-sm text-tn-on-surface-variant">This roundup may be unpublished or the link is incorrect.</div>
      </section>

      <template v-else>
	        <section class="glass-panel rounded-2xl p-6 md:p-8">
	          <div class="flex flex-col gap-6">
	            <div class="flex flex-wrap items-start justify-between gap-6">
	              <div class="max-w-2xl">
	                <div class="flex flex-wrap items-center gap-2">
	                  <span class="inline-flex items-center rounded-full bg-tn-primary/15 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20">
	                    {{ roundup.week_label }}
	                  </span>
	                  <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/40 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
	                    Classification: {{ classificationLabel }}
	                  </span>
	                </div>

	                <h1 class="mt-4 font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl md:leading-[1.05]">
	                  WEEKLY INTELLIGENCE BRIEFING
	                </h1>
	                <p class="mt-3 text-sm leading-relaxed text-tn-on-surface-variant">
	                  {{ roundup.date_from }} to {{ roundup.date_to }}
	                  <span v-if="typeof roundup.article_count === 'number'" class="ml-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
	                    {{ roundup.article_count }} articles
	                  </span>
	                </p>
	              </div>

	              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
	                <div class="rounded-xl bg-tn-surface-lowest/40 p-4 ring-1 ring-white/10">
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Articles scanned</div>
	                  <div class="mt-2 font-headline text-2xl font-black text-tn-on-surface">
	                    {{ typeof roundup.article_count === 'number' ? roundup.article_count : '—' }}
	                  </div>
	                </div>
	                <div class="rounded-xl bg-tn-surface-lowest/40 p-4 ring-1 ring-white/10">
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Top IOCs</div>
	                  <div class="mt-2 font-headline text-2xl font-black text-tn-on-surface">{{ topIocs.length || '—' }}</div>
	                </div>
	                <div class="hidden sm:block rounded-xl bg-tn-surface-lowest/40 p-4 ring-1 ring-white/10">
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Awareness links</div>
	                  <div class="mt-2 font-headline text-2xl font-black text-tn-on-surface">{{ awarenessLinks.length || '—' }}</div>
	                </div>
	              </div>
	            </div>

	            <div class="flex flex-wrap items-center gap-2">
	              <a
	                v-if="stixHref"
	                :href="stixHref"
	                class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-black hover:brightness-110"
	              >
	                <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
	                Download STIX
	              </a>

	              <a
	                :href="`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`"
	                target="_blank"
	                rel="noopener noreferrer"
	                class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-[#0A66C2]/10 hover:text-[#0A66C2]"
	              >
	                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
	                LinkedIn
	              </a>

	              <a
	                :href="`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTweetText}`"
	                target="_blank"
	                rel="noopener noreferrer"
	                class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
	              >
	                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
	                X
	              </a>

	              <button
	                type="button"
	                class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
	                @click="copyLink"
	              >
	                <UIcon :name="copiedLink ? 'i-heroicons-check' : 'i-heroicons-link'" class="h-4 w-4" />
	                {{ copiedLink ? 'Copied' : 'Copy link' }}
	              </button>
	            </div>
	          </div>
	        </section>

		<section v-if="hasExecSummary" class="mt-6 glass-panel overflow-hidden rounded-2xl">
			<!-- Cover image (if present) -->
			<div v-if="roundup.cover_image_url" class="relative">
				<img
					:src="roundup.cover_image_url"
					:alt="roundup.tagline || 'Weekly roundup cover'"
					class="w-full aspect-[16/9] object-cover"
				>
				<div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-tn-surface-low/90 to-transparent" />
			</div>

			<!-- Tagline -->
			<div v-if="roundup.tagline" class="px-6 pt-6 md:px-8 md:pt-8">
				<p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Tagline</p>
				<h2 class="mt-2 text-balance font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">
					<em class="not-italic text-tn-primary">{{ roundup.tagline }}</em>
				</h2>
			</div>

			<!-- Executive summary -->
			<div v-if="roundup.executive_summary" class="px-6 py-6 md:px-8 md:py-8">
				<p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Executive Summary</p>
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div class="weekly-markdown mt-3 text-tn-on-surface-variant" v-html="renderedExecSummary" />
			</div>
		</section>

	        <section class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
	          <div class="md:col-span-8 space-y-6">
	            <section class="glass-panel rounded-2xl p-6 md:p-8">
	              <div class="mb-4 flex items-center justify-between gap-4">
	                <div class="flex items-center gap-3">
	                  <span class="h-6 w-1.5 rounded-full bg-tn-primary" />
	                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">TLDR</div>
	                </div>
	                <UIcon name="i-heroicons-shield-check" class="h-5 w-5 text-tn-primary/80" />
	              </div>
	              <!-- eslint-disable-next-line vue/no-v-html -->
	              <div class="weekly-markdown" v-html="tldrHtml" />
	            </section>

	            <div v-if="breakdownSections.length" class="space-y-4">
	              <div class="flex items-center justify-between gap-4">
	                <h2 class="font-headline text-xl font-black tracking-tight text-tn-on-surface">Intelligence Breakdown</h2>
	                <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
	                  {{ breakdownSections.length }} modules
	                </span>
	              </div>
	              <div class="grid grid-cols-1 gap-6">
	                <article
	                  v-for="sec in breakdownSections"
	                  :key="sec.key"
	                  class="glass-panel rounded-2xl border-l-4 p-6 md:p-7"
	                  :style="{ borderLeftColor: sec.color }"
	                >
	                  <header class="flex items-start justify-between gap-4">
	                    <div class="flex min-w-0 items-center gap-3">
	                      <div
	                        class="flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1 ring-white/10"
	                        :style="{ backgroundColor: sec.color + '22', color: sec.color }"
	                      >
	                        <UIcon :name="sec.icon" class="h-5 w-5" />
	                      </div>
	                      <div class="min-w-0">
	                        <div class="truncate font-headline text-base font-black tracking-tight text-tn-on-surface">
	                          {{ sec.title }}
	                        </div>
	                        <div class="mt-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
	                          {{ sec.key.toUpperCase() }}
	                        </div>
	                      </div>
	                    </div>
	                    <span class="font-mono text-[10px] uppercase tracking-widest text-slate-500">{{ roundup.week_label }}</span>
	                  </header>

	                  <div class="mt-4 h-px w-full bg-white/10" />

	                  <!-- eslint-disable-next-line vue/no-v-html -->
	                  <div class="weekly-markdown weekly-card-markdown" v-html="sec.html" />
	                </article>
	              </div>
	            </div>

	            <div v-if="regulatorySections.length" class="space-y-4 pt-2">
	              <div class="h-px w-full bg-white/10" />
	              <h2 class="font-headline text-xl font-black tracking-tight text-tn-on-surface">Regulatory Updates</h2>
	              <div class="grid grid-cols-1 gap-6">
	                <article
	                  v-for="sec in regulatorySections"
	                  :key="sec.key"
	                  class="glass-panel rounded-2xl border-l-4 p-6 md:p-7"
	                  :style="{ borderLeftColor: sec.color }"
	                >
	                  <header class="flex items-center gap-3">
	                    <div
	                      class="flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1 ring-white/10"
	                      :style="{ backgroundColor: sec.color + '22', color: sec.color }"
	                    >
	                      <UIcon :name="sec.icon" class="h-5 w-5" />
	                    </div>
	                    <div class="min-w-0">
	                      <div class="truncate font-headline text-base font-black tracking-tight text-tn-on-surface">{{ sec.title }}</div>
	                      <div class="mt-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
	                        Action items and policy signal
	                      </div>
	                    </div>
	                  </header>
	                  <div class="mt-4 h-px w-full bg-white/10" />
	                  <!-- eslint-disable-next-line vue/no-v-html -->
	                  <div class="weekly-markdown weekly-card-markdown" v-html="sec.html" />
	                </article>
	              </div>
	            </div>
	          </div>

	          <aside class="md:col-span-4 space-y-6 md:self-start md:sticky md:top-10">
	            <section v-if="topIocs.length" class="glass-panel rounded-2xl p-6">
	              <div class="mb-3 flex items-center justify-between gap-3">
	                <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Top IOCs</div>
	                <span class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20">
	                  {{ topIocs.length }}
	                </span>
	              </div>
	              <ul class="max-h-[520px] space-y-2 overflow-y-auto pr-1">
	                <li v-for="(ioc, idx) in topIocs" :key="idx" class="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
	                  <div class="flex items-center justify-between gap-2">
	                    <span class="font-mono text-[10px] uppercase tracking-widest text-slate-400">{{ ioc.type }}</span>
	                    <button
	                      type="button"
	                      class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary"
	                      @click="copyText(`${ioc.type}: ${ioc.value}`)"
	                    >
	                      Copy
	                    </button>
	                  </div>
	                  <div class="mt-1 break-all font-mono text-xs text-tn-on-surface">{{ ioc.value }}</div>
	                  <div v-if="ioc.context" class="mt-1 text-xs text-tn-on-surface-variant">{{ ioc.context }}</div>
	                </li>
	              </ul>
	              <div v-if="stixHref" class="mt-4">
	                <a
	                  :href="stixHref"
	                  class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20 transition-colors hover:bg-tn-primary/10"
	                >
	                  <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
	                  Download STIX bundle
	                </a>
	              </div>
	            </section>

	            <section v-if="awarenessLinks.length" class="glass-panel rounded-2xl p-6">
	              <div class="mb-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Awareness links</div>
	              <ul class="space-y-2">
	                <li v-for="a in awarenessLinks" :key="a.slug" class="text-sm">
	                  <NuxtLink :to="`/awareness/${a.slug}`" class="text-tn-primary hover:underline">
	                    {{ a.title }}
	                  </NuxtLink>
	                </li>
	              </ul>
	            </section>

	            <section class="glass-panel rounded-2xl p-6">
	              <div class="mb-3 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Social copy</div>

	              <div class="space-y-3">
	                <div>
	                  <div class="mb-1 text-xs font-semibold text-tn-on-surface">X</div>
	                  <button
	                    type="button"
	                    class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
	                    :disabled="!socialX"
	                    @click="copySocialX"
	                  >
	                    <UIcon :name="copiedX ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="h-4 w-4" />
	                    {{ copiedX ? 'Copied' : 'Copy X text' }}
	                  </button>
	                </div>

	                <div>
	                  <div class="mb-1 text-xs font-semibold text-tn-on-surface">LinkedIn</div>
	                  <button
	                    type="button"
	                    class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
	                    :disabled="!socialLinkedIn"
	                    @click="copySocialLinkedIn"
	                  >
	                    <UIcon :name="copiedLinkedIn ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="h-4 w-4" />
	                    {{ copiedLinkedIn ? 'Copied' : 'Copy LinkedIn text' }}
	                  </button>
	                </div>
	              </div>
	            </section>
	          </aside>
	        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import JsonLd from '~/components/seo/JsonLd.vue'
import { marked } from 'marked'
	import { useToast } from '~/composables/useToast'

import { safeHref } from '~/composables/useSafeHref'

type AwarenessLink = { slug: string; title: string }
type TopIoc = { type: string; value: string; context?: string }

type WeeklyRoundup = {
  id: string
  week_label: string
  slug: string
  date_from: string
  date_to: string
	executive_summary?: string | null
	tagline?: string | null
	cover_image_url?: string | null
  tldr: string | null
  full_brief: string
  top_iocs: TopIoc[] | null
  awareness_links: AwarenessLink[] | null
  social_linkedin: string | null
  social_x: string | null
  article_count: number | null
  published_at: string | null
  created_at: string
}

type RoundupResponse = { roundup: WeeklyRoundup }

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim())

const { data, pending } = await useFetch<RoundupResponse>(() => `/api/weekly/${encodeURIComponent(slug.value)}`)
const roundup = computed(() => data.value?.roundup || null)

const seoDescription = computed(() => {
  const raw = (roundup.value?.tldr || roundup.value?.full_brief || '').trim()
  if (!raw) return 'Weekly threat intelligence roundup curated for practitioners.'
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  return cleaned.length <= 155 ? cleaned : cleaned.slice(0, 155).trim() + '...'
})

const cardImage = computed(() => {
	const cover = (roundup.value?.cover_image_url || '').trim()
	if (cover) return cover
  const s = roundup.value?.slug
  if (!s) return 'https://threatnoir.com/images/category-default.png'
  return `https://threatnoir.com/images/weekly/${s}-card.png`
})

useSeoMeta({
  title: computed(() => (roundup.value ? `Weekly Roundup ${roundup.value.week_label} | ThreatNoir` : 'Weekly Threat Roundup | ThreatNoir')),
  description: seoDescription,
  ogTitle: computed(() => (roundup.value ? `Weekly Roundup ${roundup.value.week_label} | ThreatNoir` : 'Weekly Threat Roundup | ThreatNoir')),
  ogDescription: seoDescription,
  ogImage: cardImage,
  ogUrl: computed(() => (roundup.value?.slug ? `https://threatnoir.com/weekly/${roundup.value.slug}` : 'https://threatnoir.com/weekly')),
  ogType: 'article',
  articleAuthor: 'Marcus Lenngren',
  articlePublishedTime: computed(() => roundup.value?.date_from ? `${roundup.value.date_to}T00:00:00Z` : undefined),
  twitterCard: 'summary_large_image',
  author: 'Marcus Lenngren'
})

const shareUrl = computed(() => (roundup.value?.slug ? `https://threatnoir.com/weekly/${roundup.value.slug}` : ''))

const structuredData = computed(() => {
  if (!roundup.value?.slug) return null

  const url = `https://threatnoir.com/weekly/${roundup.value.slug}`

  return [
    useNewsArticleSchema({
      title: `Weekly Roundup ${roundup.value.week_label}`,
      description: seoDescription.value,
      url,
      published_at: roundup.value.published_at || roundup.value.date_to,
      image_url: cardImage.value
    }),
    useBreadcrumbSchema([
      { name: 'Home', url: 'https://threatnoir.com' },
      { name: 'Weekly', url: 'https://threatnoir.com/weekly' },
      { name: roundup.value.week_label, url }
    ])
  ]
})
const encodedUrl = computed(() => encodeURIComponent(shareUrl.value))
const tweetText = computed(() => {
  const s = (roundup.value?.social_x || '').trim()
  if (s) return s
  return roundup.value ? `Weekly Threat Roundup ${roundup.value.week_label}` : 'Weekly Threat Roundup'
})
const encodedTweetText = computed(() => encodeURIComponent(tweetText.value))

const socialX = computed(() => (roundup.value?.social_x || '').trim())
const socialLinkedIn = computed(() => (roundup.value?.social_linkedin || '').trim())

const topIocs = computed(() => (Array.isArray(roundup.value?.top_iocs) ? roundup.value?.top_iocs ?? [] : []))
const awarenessLinks = computed(() => (Array.isArray(roundup.value?.awareness_links) ? roundup.value?.awareness_links ?? [] : []))

const stixHref = computed(() => {
  const s = roundup.value?.slug
  if (!s) return ''
  return `/api/weekly/${encodeURIComponent(s)}/stix`
})

const classificationLabel = computed(() => 'PUBLIC')

const hasExecSummary = computed(() => {
	const r = roundup.value
	if (!r) return false
	return Boolean((r.executive_summary || '').trim() || (r.tagline || '').trim() || (r.cover_image_url || '').trim())
})

const renderedExecSummary = computed(() => {
	const raw = (roundup.value?.executive_summary || '').trim()
	if (!raw) return ''
	return renderMarkdown(raw)
})

const tldrHtml = computed(() => {
  const raw = (roundup.value?.tldr || '').trim()
  if (!raw) return ''
  // Convert emoji-prefixed lines into a proper markdown list
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const asList = lines.map((l) => {
    // If line already starts with - or *, keep it
    if (/^[-*]\s/.test(l)) return l
    // Otherwise wrap as list item
    return `- ${l}`
  }).join('\n')
  return renderMarkdown(asList)
})

function escapeAttr(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeMarkdown(src: string): string {
  // Convert Unicode bullet characters (•, ·, ●, ▪) at the start of lines to
  // standard markdown hyphens so marked treats them as list items. LLMs
  // occasionally emit these even when told to use hyphens.
  // Layer 1: bullets at line start -> '- '
  let s = (src || '').replace(/^[ \t]*[\u2022\u00B7\u25CF\u25AA][ \t]+/gm, '- ')

  // Layer 2: if the LLM concatenates multiple **[Title](url)** stories on one
  // line, split them into separate paragraphs.
  // Pattern: sentence terminator + whitespace + bold-link.
  s = s.replace(/([.!?])[ \t]+(\*\*\[)/g, '$1\n\n$2')

  return s
}

function renderMarkdown(src: string): string {
  const renderer = new marked.Renderer()
  renderer.link = ({ href, title, text }) => {
    const safe = escapeAttr(safeHref(href || ''))
    const t = title ? ` title="${escapeAttr(title)}"` : ''
    return `<a href="${safe}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
  }
  renderer.html = () => ''

  const raw = marked.parse(normalizeMarkdown(src || ''), {
    renderer,
    gfm: true,
    mangle: false,
    headerIds: false
  }) as string

  return raw
}

type BriefSection = {
  title: string
  key: string
  color: string
  icon: string
  html: string
  isRegulatory: boolean
}

const categoryColors: Record<string, string> = {
  vulnerabilities: '#ef4444',
  ransomware: '#f97316',
  'supply chain': '#8b5cf6',
  apt: '#06b6d4',
  regulatory: '#ec4899',
  breaches: '#f43f5e',
  malware: '#eab308',
  default: '#4cd7f6'
}

const categoryIcons: Record<string, string> = {
  vulnerabilities: 'i-heroicons-bug-ant',
  ransomware: 'i-heroicons-lock-closed',
  'supply chain': 'i-heroicons-link',
  apt: 'i-heroicons-globe-alt',
  regulatory: 'i-heroicons-scale',
  breaches: 'i-heroicons-exclamation-triangle',
  malware: 'i-heroicons-command-line',
  default: 'i-heroicons-squares-2x2'
}

function normalizeCategoryKey(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bucketForCategory(title: string): string {
  const k = normalizeCategoryKey(title)
  if (k.includes('vulnerab') || k.includes('exploit') || k.includes('cve')) return 'vulnerabilities'
  if (k.includes('ransom') || k.includes('extortion')) return 'ransomware'
  if (k.includes('supply chain') || k.includes('ecosystem') || k.includes('dependency')) return 'supply chain'
  if (k.includes('apt') || k.includes('nation state') || k.includes('nation-state')) return 'apt'
  if (k.includes('regulatory') || k.includes('compliance') || k.includes('policy')) return 'regulatory'
  if (k.includes('breach') || k.includes('leak') || k.includes('incident')) return 'breaches'
  if (k.includes('malware') || k.includes('botnet')) return 'malware'
  return 'default'
}

function parseBriefSections(src: string): BriefSection[] {
  const text = (src || '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const re = /^##\s+(.+)$/gm
  const headings: Array<{ title: string; index: number; contentStart: number }> = []
  let m: RegExpExecArray | null = null
  while ((m = re.exec(text))) {
    headings.push({ title: (m[1] || '').trim(), index: m.index, contentStart: re.lastIndex })
  }

  const out: BriefSection[] = []
  const preface = headings.length ? text.slice(0, headings[0].index).trim() : text
  if (preface) {
    out.push({
      title: 'Overview',
      key: 'overview',
      color: categoryColors.default,
      icon: categoryIcons.default,
      html: renderMarkdown(preface),
      isRegulatory: false
    })
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const next = headings[i + 1]
    const body = text.slice(h.contentStart, next ? next.index : text.length).trim()
    if (!h.title || !body) continue

    const bucket = bucketForCategory(h.title)
    const key = normalizeCategoryKey(h.title).replace(/\s+/g, '-') || `section-${i}`
    out.push({
      title: h.title,
      key,
      color: categoryColors[bucket] || categoryColors.default,
      icon: categoryIcons[bucket] || categoryIcons.default,
      html: renderMarkdown(body),
      isRegulatory: bucket === 'regulatory'
    })
  }

  return out
}

const briefSections = computed(() => parseBriefSections(roundup.value?.full_brief || ''))
const breakdownSections = computed(() => briefSections.value.filter((s) => !s.isRegulatory))
const regulatorySections = computed(() => briefSections.value.filter((s) => s.isRegulatory))

const copiedLink = ref(false)
const copiedX = ref(false)
const copiedLinkedIn = ref(false)

async function copyText(text: string) {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(text)
	    useToast().show('Copied')
	} catch {
		  useToast().show('Copy failed', 'error')
	  // ignore
	}
}

async function copyLink() {
  if (!import.meta.client || !shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
	    useToast().show('Link copied')
    copiedLink.value = true
    setTimeout(() => {
      copiedLink.value = false
    }, 2000)
	} catch {
		  useToast().show('Copy failed', 'error')
	  // ignore
	}
}

async function copySocialX() {
  const txt = socialX.value
  if (!txt) return
  await copyText(txt)
  copiedX.value = true
  setTimeout(() => {
    copiedX.value = false
  }, 2000)
}

async function copySocialLinkedIn() {
  const txt = socialLinkedIn.value
  if (!txt) return
  await copyText(txt)
  copiedLinkedIn.value = true
  setTimeout(() => {
    copiedLinkedIn.value = false
  }, 2000)
}
</script>

<style scoped>
.weekly-markdown {
  color: var(--color-tn-on-surface);
  line-height: 1.75;
  font-size: 0.975rem;
}

/* Used for per-card rendering (adds subtle separation inside a single category panel). */
.weekly-card-markdown :deep(p + p) {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.weekly-markdown :deep(h1) {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 800;
  color: var(--color-tn-on-surface);
}

.weekly-markdown :deep(h1:first-child) {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.weekly-markdown :deep(h2) {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-tn-primary);
}

.weekly-markdown :deep(h2:first-child) {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.weekly-markdown :deep(h3) {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  line-height: 1.5rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.weekly-markdown :deep(p) {
  margin: 0.75rem 0;
  color: var(--color-tn-on-surface-variant);
}

.weekly-markdown :deep(ul),
.weekly-markdown :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 0;
  list-style: none;
  color: var(--color-tn-on-surface-variant);
}

.weekly-markdown :deep(li) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.weekly-markdown :deep(ul > li)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-tn-primary);
  opacity: 0.7;
}

.weekly-markdown :deep(ol) {
  counter-reset: item;
}

.weekly-markdown :deep(ol > li) {
  counter-increment: item;
}

.weekly-markdown :deep(ol > li)::before {
  content: counter(item) '.';
  position: absolute;
  left: 0;
  font-weight: 700;
  font-size: 0.85em;
  color: var(--color-tn-primary);
}

.weekly-markdown :deep(strong) {
  color: var(--color-tn-on-surface);
  font-weight: 700;
}

.weekly-markdown :deep(a) {
  color: var(--color-tn-primary);
  text-decoration: underline;
  text-decoration-color: rgba(76, 215, 246, 0.3);
  text-underline-offset: 4px;
}

.weekly-markdown :deep(a:hover) {
  text-decoration-color: var(--color-tn-primary);
}

.weekly-markdown :deep(hr) {
  margin: 1.5rem 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.weekly-markdown :deep(blockquote) {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--color-tn-primary);
  background: rgba(76, 215, 246, 0.04);
  border-radius: 0 0.5rem 0.5rem 0;
  color: var(--color-tn-on-surface-variant);
}

.weekly-markdown :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  color: var(--color-tn-primary);
}

.weekly-markdown :deep(blockquote) {
  margin: 1rem 0;
  padding-left: 1rem;
  border-left: 2px solid rgba(61, 73, 76, 0.4);
  color: var(--color-tn-on-surface-variant);
}

.weekly-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.15em 0.35em;
  border-radius: 0.35rem;
}

.weekly-markdown :deep(pre) {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: auto;
}

.weekly-markdown :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
}

.weekly-markdown :deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.weekly-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.weekly-markdown :deep(th),
.weekly-markdown :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem;
}

.weekly-markdown :deep(th) {
  color: var(--color-tn-on-surface);
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}
</style>
