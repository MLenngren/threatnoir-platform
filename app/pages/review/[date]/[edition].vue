<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-4xl px-6">
		      <section class="glass-panel rounded-2xl p-6 md:p-8">
		        <div class="flex items-center gap-3">
		          <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
		          <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Weekly review</span>
		        </div>
		        <h1 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
		          {{ review.title }}
		        </h1>

		        <div class="mt-4 flex flex-wrap items-center gap-2">
		          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ review.date }}</span>
		          <span class="h-1 w-1 rounded-full bg-white/20" />
		          <span class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/25">
		            {{ editionLabel(review.edition) }}
		          </span>
		          <template v-if="typeof review.article_count === 'number'">
		            <span class="h-1 w-1 rounded-full bg-white/20" />
		            <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ review.article_count }} articles</span>
		          </template>
		        </div>
		      </section>

		      <section v-if="safeHref(review.audio_url) !== '#'" class="mt-6 glass-panel rounded-2xl p-5">
		        <div class="flex flex-wrap items-center justify-between gap-4">
		          <div>
		            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Audio</div>
		            <div class="mt-1 font-headline text-base font-bold text-tn-on-surface">Listen to the episode</div>
		          </div>
		          <button
		            type="button"
		            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-4 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
		            @click="play"
		          >
		            <UIcon name="i-heroicons-play" class="h-4 w-4" />
		            Play
		          </button>
		        </div>

		        <div class="mt-4">
		          <audio ref="audioEl" class="w-full tn-audio" :src="safeHref(review.audio_url)" controls preload="none" />
		          <a
		            class="mt-3 inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
		            :href="safeHref(review.audio_url)"
		            target="_blank"
		            rel="noopener noreferrer"
		          >
		            Open audio in new tab
		          </a>
		        </div>
		      </section>

	      <section class="mt-8 glass-panel rounded-2xl p-6 md:p-8">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="review-markdown" v-html="articleHtml" />
      </section>

		      <ArticleIocs v-if="Array.isArray(review.sources) && review.sources.length" class="mt-10" :sources="review.sources" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import ArticleIocs from '~/components/ArticleIocs.vue'
import { safeHref } from '~/composables/useSafeHref'

const audioEl = ref<HTMLAudioElement | null>(null)

type Review = {
  date: string
  edition: string
  title: string
  article_text: string
  audio_url: string | null
  article_count: number | null
  created_at: string

	  sources: ReviewSource[]
}

type ReviewSourceIoc = {
	  type: string
	  value: string
	  context: string | null
}

type ReviewSource = {
	  article_id: string
	  title: string
	  url: string
	  iocs: ReviewSourceIoc[]
}

const route = useRoute()
const date = String(route.params.date || '')
const edition = String(route.params.edition || '')

const { data } = await useAsyncData(`review:${date}:${edition}`, async () => {
  try {
    return await $fetch<Review>(`/api/reviews/${date}/${edition}`)
  } catch (err: unknown) {
    const status = getErrorStatus(err)
    if (status === 404) return null
    throw err
  }
})

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Review not found' })
}

const review = computed(() => {
  const r = data.value as Review
  return {
    ...r,
    title: r.title || `${r.date} ${editionLabel(r.edition)} review`
  }
})

const articleHtml = computed(() => renderMarkdown(review.value.article_text || ''))

const description = computed(() => {
  const raw = (review.value.article_text || '')
    .replace(/```[^`]*```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#_*`>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return raw.slice(0, 160) || 'Podcast companion review article.'
})

	const site = useSiteConfig()

useHead(() => ({
	  title: `${review.value.title} — ${site.name}`,
  meta: [
    { name: 'description', content: description.value },
	    { property: 'og:title', content: `${review.value.title} — ${site.name}` },
    { property: 'og:description', content: description.value }
  ]
}))

function editionLabel(edition: string) {
  const e = (edition || '').toLowerCase()
  if (e === 'morning') return 'Morning'
  if (e === 'afternoon') return 'Afternoon'
  return edition
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Record<string, unknown>
  const status = e.statusCode ?? e.status
  return typeof status === 'number' ? status : undefined
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderMarkdown(src: string): string {
  const renderer = new marked.Renderer()
  renderer.link = ({ href, title, text }) => {
		const safe = escapeAttr(safeHref(href || ''))
    const t = title ? ` title="${escapeAttr(title)}"` : ''
    return `<a href="${safe}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
  }

  // Defense-in-depth: ignore any raw HTML embedded in markdown.
  renderer.html = () => ''

  const raw = marked.parse(src, {
    renderer,
    gfm: true,
    mangle: false,
    headerIds: false
  }) as string

	// DOMPurify removed — isomorphic-dompurify pulls jsdom which breaks Vercel serverless (CJS/ESM conflict).
	// Defense-in-depth is already handled above: renderer.html strips raw HTML, links are escaped via safeHref.
	return raw
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
.review-markdown {
  color: var(--color-tn-on-surface);
  line-height: 1.75;
  font-size: 0.975rem;
}

.review-markdown :deep(h1) {
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.review-markdown :deep(h2) {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.review-markdown :deep(h3) {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  line-height: 1.6rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.review-markdown :deep(p) {
  margin: 0.75rem 0;
  color: var(--color-tn-on-surface-variant);
}

.review-markdown :deep(ul),
.review-markdown :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.25rem;
  color: var(--color-tn-on-surface-variant);
}

.review-markdown :deep(li) {
  margin: 0.25rem 0;
}

.review-markdown :deep(a) {
  color: var(--color-tn-primary);
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 4px;
}

.review-markdown :deep(a:hover) {
  opacity: 0.9;
}

.review-markdown :deep(blockquote) {
  margin: 1rem 0;
  padding-left: 1rem;
  border-left: 2px solid rgba(61, 73, 76, 0.4);
  color: var(--color-tn-on-surface-variant);
}

.review-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.15em 0.35em;
  border-radius: 0.35rem;
}

.review-markdown :deep(pre) {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: auto;
}

.review-markdown :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
}

.review-markdown :deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.review-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.review-markdown :deep(th),
.review-markdown :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem;
}

.review-markdown :deep(th) {
  color: var(--color-tn-on-surface);
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}
</style>
