<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-4xl px-6">
      <NuxtLink
        to="/feed"
        class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to Feed
      </NuxtLink>

      <div v-if="pending" class="mt-8 rounded-xl bg-tn-surface-low/70 p-8 text-sm text-tn-on-surface-variant">
        Loading...
      </div>

      <div v-else-if="error || !article" class="mt-8 rounded-xl bg-tn-surface-low/70 p-10 text-center">
        <div class="font-headline text-xl font-bold text-tn-on-surface">Article not found</div>
        <p class="mt-2 text-sm text-tn-on-surface-variant">
          This article may have been removed or the link is incorrect.
        </p>
      </div>

      <article v-else class="mt-6">
        <header class="glass-panel rounded-2xl p-6 md:p-8">
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="article.category"
              class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10"
            >
              {{ article.category.name }}
            </span>
            <span v-if="formattedDate" class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
              {{ formattedDate }}
            </span>
          </div>

          <h1 class="mt-4 font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
            {{ article.title }}
          </h1>

          <p v-if="article.brief || article.ai_summary" class="mt-4 text-base leading-7 text-tn-on-surface-variant">
            {{ article.brief || article.ai_summary }}
          </p>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <a
              :href="article.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-lg bg-tn-primary px-4 py-2 text-sm font-bold text-tn-on-primary hover:brightness-110"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
              Read at source
            </a>

            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-tn-surface-high px-4 py-2 text-sm text-tn-on-surface hover:bg-tn-surface-highest"
              @click="copyLink"
            >
              <UIcon :name="copied ? 'i-heroicons-check' : 'i-heroicons-link'" class="h-4 w-4" />
              {{ copied ? 'Copied' : 'Copy link' }}
            </button>
          </div>
        </header>

        <section v-if="article.ai_summary" class="mt-6 glass-panel rounded-2xl p-6 md:p-8">
          <h2 class="font-headline text-lg font-bold text-tn-on-surface">Summary</h2>
          <p class="mt-3 text-sm leading-7 text-tn-on-surface-variant">
            {{ article.ai_summary }}
          </p>
        </section>

        <section v-if="article.full_text" class="mt-6 glass-panel rounded-2xl p-6 md:p-8">
          <h2 class="font-headline text-lg font-bold text-tn-on-surface">Full text</h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-7 text-tn-on-surface-variant">
            {{ article.full_text }}
          </p>
        </section>

        <section v-if="iocs.length" class="mt-6 glass-panel rounded-2xl p-6 md:p-8">
          <h2 class="font-headline text-lg font-bold text-tn-on-surface">Indicators of Compromise</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="(ioc, i) in iocs" :key="i" class="font-mono text-xs text-tn-on-surface-variant">
              <span class="uppercase text-tn-primary">{{ ioc.type }}</span> — {{ ioc.value }}
            </li>
          </ul>
        </section>

        <section v-if="entities.length" class="mt-6 glass-panel rounded-2xl p-6 md:p-8">
          <h2 class="font-headline text-lg font-bold text-tn-on-surface">Entities</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="e in entities"
              :key="`${e.type}:${e.name}`"
              class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-3 py-1 text-xs text-tn-on-surface ring-1 ring-white/10"
            >
              {{ e.name }}
              <span class="ml-1 text-[10px] text-tn-on-surface-variant">({{ e.type }})</span>
            </span>
          </div>
        </section>
      </article>
    </div>
  </main>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'
type Article = {
  id: string
  title: string
  slug: string
  summary: string | null
  ai_summary: string | null
  brief: string | null
  full_text: string | null
  url: string
  image_url: string | null
  published_at: string | null
  ingested_at: string | null
  relevance_score: number | null
  entities: unknown
  category: { id: string; name: string; slug: string; icon: string | null } | null
}

type Ioc = { type: string; value: string; context: string | null }

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim())

const { data, pending, error } = await useFetch<{ article: Article; iocs: Ioc[] }>(
  () => `/api/articles/${encodeURIComponent(slug.value)}`,
  { watch: [slug] }
)

const article = computed(() => data.value?.article || null)
const iocs = computed(() => data.value?.iocs ?? [])

const entities = computed(() => {
  const raw = article.value?.entities
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((e) => {
        if (!e || typeof e !== 'object') return null
        const rec = e as Record<string, unknown>
        const type = typeof rec.type === 'string' ? rec.type : null
        const name = typeof rec.name === 'string' ? rec.name : null
        if (!type || !name) return null
        return { type, name }
      })
      .filter((v): v is { type: string; name: string } => !!v)
  }
  return []
})

const formattedDate = computed(() => {
  const raw = article.value?.published_at || article.value?.ingested_at
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
})

const seoDescription = computed(() => {
  const raw = article.value?.brief || article.value?.ai_summary || article.value?.summary || ''
  return raw.length > 155 ? `${raw.slice(0, 155).trim()}...` : raw
})

const ogImage = computed(() => {
  const img = article.value?.image_url
  if (img) return img
  const cat = article.value?.category?.slug
  const catMap: Record<string, string> = {
    vulnerabilities: 'vulnerabilities',
    'zero-day': 'vulnerabilities',
    breaches: 'breaches',
    ransomware: 'ransomware',
    malware: 'malware',
    'supply-chain': 'supply-chain',
    'nation-state': 'nation-state',
    policy: 'policy'
  }
  const mapped = cat && catMap[cat] ? catMap[cat] : 'default'
  return `https://threatnoir.com/images/category-${mapped}.png`
})

const canonicalUrl = computed(() => {
  const s = article.value?.slug
  return s ? `https://threatnoir.com/article/${s}` : 'https://threatnoir.com'
})

useSeoMeta({
  title: computed(() => (article.value ? `${article.value.title} | ThreatNoir` : 'Article | ThreatNoir')),
  description: seoDescription,
  ogTitle: computed(() => (article.value ? `${article.value.title} | ThreatNoir` : 'Article | ThreatNoir')),
  ogDescription: seoDescription,
  ogImage,
  ogUrl: canonicalUrl,
  ogType: 'article',
  twitterCard: 'summary_large_image',
  twitterTitle: computed(() => (article.value ? article.value.title : 'Article')),
  twitterDescription: seoDescription,
  twitterImage: ogImage
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl
    }
  ],
  script: [
    {
      type: 'application/ld+json',
      children: computed(() => {
        const a = article.value
        if (!a) return ''
        const published = a.published_at || a.ingested_at
        const jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: a.title,
          description: seoDescription.value,
          datePublished: published || undefined,
          dateModified: published || undefined,
          mainEntityOfPage: canonicalUrl.value,
          url: canonicalUrl.value,
          image: [ogImage.value],
          author: [{ '@type': 'Person', name: 'Marcus Lenngren' }],
          publisher: {
            '@type': 'Organization',
            name: 'ThreatNoir',
            url: 'https://threatnoir.com'
          }
        }
        return JSON.stringify(jsonLd)
      })
    }
  ]
})

const copied = ref(false)
async function copyLink() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(window.location.href)
	    useToast().show('Link copied')
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
	    useToast().show('Copy failed', 'error')
    // ignore
  }
}
</script>
