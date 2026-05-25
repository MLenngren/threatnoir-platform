<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="flex items-center gap-3">
              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
              <NuxtLink
                to="/tips"
                class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary hover:underline hover:decoration-white/20 hover:underline-offset-4"
              >
                Tips &amp; Tricks
              </NuxtLink>
            </div>

            <h1 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
              {{ tip?.title || 'Tip' }}
            </h1>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span
                v-if="tip?.category?.name"
                class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10"
              >
                {{ tip.category.name }}
              </span>
              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ createdAtText }}
              </span>
              <span v-if="tip?.author_name" class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                • by {{ tip.author_name }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              :disabled="!tip"
              @click="copyBody"
            >
              <UIcon name="i-heroicons-clipboard-document" class="h-4 w-4" />
              Copy
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" :disabled="!tip" @click="share">
              <UIcon name="i-heroicons-share" class="h-4 w-4" />
              Share
            </UButton>
          </div>
        </div>
      </section>


      <section class="mt-8 glass-panel rounded-2xl p-6 md:p-8">
        <div v-if="pending" class="text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="error" class="text-sm text-red-200">Tip not found.</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="tip-markdown" v-html="html" />
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { marked } from 'marked'
	import { useToast } from '~/composables/useToast'

import { safeHref } from '~/composables/useSafeHref'

type TipCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
}

type TipItem = {
  id: string
  title: string
  body: string
  tags: string[]
  author_name: string
  featured: boolean
  created_at: string
  updated_at: string
  category: TipCategory | null
}

const route = useRoute()
const id = computed(() => String(route.params.id || '').trim())

const { data, pending, error } = await useFetch<{ tip: TipItem }>(`/api/tips/${encodeURIComponent(id.value)}`)

const tip = computed(() => data.value?.tip ?? null)

useSeoMeta({
  title: computed(() => (tip.value?.title ? `${tip.value.title} — ThreatNoir` : 'Tip — ThreatNoir')),
  description: computed(() => makeDescription(tip.value?.body || '')),
  ogType: 'article'
})

const createdAtText = computed(() => {
  const raw = tip.value?.created_at
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return ''
  }
})

const html = computed(() => renderMarkdown(tip.value?.body || ''))

async function copyBody() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText((tip.value?.body || '').trim())
	    useToast().show('Copied')
  } catch (e) {
	    useToast().show('Copy failed', 'error')
    console.warn('[tips/[id]] copy failed:', e)
  }
}

async function share() {
  if (!import.meta.client) return
  const url = window.location.href
  const title = (tip.value?.title || '').trim() || 'ThreatNoir tip'
  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return
    }
  } catch {
    // ignore
  }
  try {
    await navigator.clipboard.writeText(url)
	    useToast().show('Link copied')
  } catch (e) {
	    useToast().show('Copy failed', 'error')
    console.warn('[tips/[id]] share fallback copy failed:', e)
  }
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

function makeDescription(src: string) {
  const raw = (src || '')
    .replace(/```[^`]*```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#_*`>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return raw.slice(0, 160) || 'Security tip from ThreatNoir.'
}
</script>

<style scoped>
.tip-markdown {
  color: var(--color-tn-on-surface);
  line-height: 1.75;
  font-size: 0.975rem;
}

.tip-markdown :deep(h1) {
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.tip-markdown :deep(h2) {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.tip-markdown :deep(h3) {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  line-height: 1.6rem;
  font-weight: 700;
  color: var(--color-tn-on-surface);
}

.tip-markdown :deep(p) {
  margin: 0.75rem 0;
  color: var(--color-tn-on-surface-variant);
}

.tip-markdown :deep(ul),
.tip-markdown :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.25rem;
  color: var(--color-tn-on-surface-variant);
}

.tip-markdown :deep(li) {
  margin: 0.25rem 0;
}

.tip-markdown :deep(a) {
  color: var(--color-tn-primary);
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 4px;
}

.tip-markdown :deep(a:hover) {
  opacity: 0.9;
}

.tip-markdown :deep(blockquote) {
  margin: 1rem 0;
  padding-left: 1rem;
  border-left: 2px solid rgba(61, 73, 76, 0.4);
  color: var(--color-tn-on-surface-variant);
}

.tip-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.15em 0.35em;
  border-radius: 0.35rem;
}

.tip-markdown :deep(pre) {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: auto;
}

.tip-markdown :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
}

.tip-markdown :deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.tip-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.tip-markdown :deep(th),
.tip-markdown :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem;
}

.tip-markdown :deep(th) {
  color: var(--color-tn-on-surface);
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}
</style>
