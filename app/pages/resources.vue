<template>
  <main class="grid-bg py-10 md:py-14">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Hero -->
      <header class="relative mb-10 overflow-hidden">
        <div class="glass-panel rounded-3xl p-8 md:p-10">
          <div class="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div class="flex items-center gap-3">
                <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
                <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Tactical asset repository</span>
              </div>

              <h1 class="mt-4 text-balance font-headline text-5xl font-black tracking-tight text-tn-on-surface md:text-6xl">
                SECURITY <span class="text-tn-primary">RESOURCES</span>
              </h1>

              <p class="mt-4 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
                Curated posters, infographics, cheat sheets, and visual guides—designed for operational readiness.
              </p>
            </div>

            <div class="flex justify-end">
              <div class="glass-panel flex items-center gap-3 rounded-xl border-l-4 border-tn-primary p-4">
                <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-tn-primary" />
                <div>
                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Status</div>
                  <div class="text-sm font-semibold text-tn-on-surface">Verified assets</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Category filter -->
          <div class="mt-8 flex flex-wrap items-center gap-2 rounded-2xl bg-black/10 p-2 ring-1 ring-white/10">
            <button
              v-for="c in categories"
              :key="c"
              type="button"
              class="rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition"
              :class="selectedCategory === c ? 'bg-tn-primary/10 text-tn-primary' : 'text-tn-on-surface-variant hover:bg-white/[0.04] hover:text-tn-on-surface'"
              @click="selectCategory(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </header>

      <!-- Grid -->
      <section>
        <div v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">Loading…</div>

        <div v-else-if="!items.length" class="glass-panel rounded-2xl p-10 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
            <UIcon name="i-heroicons-photo" class="h-6 w-6 text-tn-primary" />
          </div>
          <div class="font-headline text-base font-bold text-tn-on-surface">No resources yet.</div>
          <div class="mt-1 text-sm text-tn-on-surface-variant">Check back soon—new assets are added regularly.</div>
        </div>

        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Featured -->
          <article
            v-if="featured"
            class="glass-panel group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(76,215,246,0.12)] sm:col-span-2"
          >
            <component :is="featured.url ? 'a' : 'button'" :href="featured.url || undefined" :target="featured.url ? '_blank' : undefined" :rel="featured.url ? 'noopener noreferrer' : undefined" :type="featured.url ? undefined : 'button'" class="block w-full text-left" @click="featured.url ? undefined : openLightbox(featured)">
              <div class="relative aspect-[16/9] overflow-hidden">
                <img
                  v-if="featured.image_url"
                  :src="featured.image_url"
                  :alt="featured.title"
                  class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                >
                <div v-else class="flex h-full w-full items-center justify-center bg-tn-surface-lowest/40">
                  <UIcon name="i-heroicons-photo" class="h-10 w-10 text-tn-primary/60" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div class="absolute left-4 top-4">
                  <span class="inline-flex items-center rounded-full bg-tn-primary px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-black">
                    Featured
                  </span>
                </div>
              </div>
              <div class="p-7">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20">{{ typeLabel(featured.content_type) }}</span>
                  <span v-if="featured.category" class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">{{ featured.category }}</span>
                </div>
                <h2 class="mt-4 text-balance font-headline text-2xl font-black tracking-tight text-tn-on-surface">
                  {{ featured.title }}
                </h2>
                <p v-if="featured.description" class="mt-2 line-clamp-2 text-sm text-tn-on-surface-variant">
                  {{ featured.description }}
                </p>
                <div class="mt-6 flex items-center justify-between">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="t in (featured.tags ?? []).slice(0, 4)" :key="t" class="inline-flex items-center rounded-full bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">{{ t }}</span>
                  </div>
                  <div class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110">
                    View
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                  </div>
                </div>
              </div>
            </component>
          </article>

          <!-- Standard cards -->
          <article
            v-for="r in rest"
            :key="r.id"
            class="glass-panel group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(76,215,246,0.10)]"
          >
            <component :is="r.url ? 'a' : 'button'" :href="r.url || undefined" :target="r.url ? '_blank' : undefined" :rel="r.url ? 'noopener noreferrer' : undefined" :type="r.url ? undefined : 'button'" class="block w-full text-left" @click="r.url ? undefined : openLightbox(r)">
              <div class="relative aspect-[4/3] overflow-hidden">
                <img
                  v-if="r.image_url"
                  :src="r.image_url"
                  :alt="r.title"
                  class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                >
                <div v-else class="flex h-full w-full items-center justify-center bg-tn-surface-lowest/40">
                  <UIcon name="i-heroicons-photo" class="h-8 w-8 text-tn-primary/60" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
              </div>

              <div class="p-6">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20">{{ typeLabel(r.content_type) }}</span>
                  <span v-if="r.category" class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">{{ r.category }}</span>
                </div>

                <h3 class="mt-3 line-clamp-2 font-headline text-lg font-bold tracking-tight text-tn-on-surface">
                  {{ r.title }}
                </h3>

                <p v-if="r.description" class="mt-2 line-clamp-2 text-sm text-tn-on-surface-variant">
                  {{ r.description }}
                </p>

                <div class="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="t in (r.tags ?? []).slice(0, 3)" :key="t" class="inline-flex items-center rounded-full bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">{{ t }}</span>
                  </div>
                  <div v-if="r.url" class="inline-flex items-center gap-2 rounded-lg bg-tn-primary/10 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20 hover:bg-tn-primary/20">
                    Visit
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                  </div>
                  <div v-else class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/50 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-primary/10 hover:text-tn-primary">
                    View
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                  </div>
                </div>
              </div>
            </component>
          </article>
        </div>
      </section>
    </div>

    <!-- Lightbox -->
    <UModal v-model:open="lightboxOpen" :title="lightbox?.title || 'Resource'" :description="lightbox?.category || undefined">
      <template #content>
        <div class="space-y-4">
          <div class="overflow-hidden rounded-xl ring-1 ring-white/10">
            <img
              v-if="lightbox?.image_url"
              :src="lightbox.image_url"
              :alt="lightbox.title"
              class="h-auto w-full"
            >
            <div v-else class="flex h-56 w-full items-center justify-center bg-tn-surface-lowest/40">
              <UIcon name="i-heroicons-photo" class="h-8 w-8 text-tn-primary/60" />
            </div>
          </div>

          <p v-if="lightbox?.description" class="text-sm text-tn-on-surface-variant">
            {{ lightbox.description }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <span v-if="lightbox" class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20">{{ typeLabel(lightbox.content_type) }}</span>
            <span v-for="t in (lightbox?.tags ?? [])" :key="t" class="inline-flex items-center rounded-full bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">{{ t }}</span>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <UButton color="gray" variant="soft" @click="lightboxOpen = false">Close</UButton>
            <UButton
              v-if="lightbox?.url"
              :to="lightbox.url"
              target="_blank"
            >
              Visit resource
            </UButton>
            <UButton
              v-else-if="lightbox?.image_url"
              :to="lightbox.image_url"
              target="_blank"
            >
              Open in new tab
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>

<script setup lang="ts">
type ResourceRow = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  url: string | null
  content_type: 'poster' | 'infographic' | 'cheat_sheet' | 'guide' | string
  category: string | null
  tags: string[] | null
  featured: boolean
  published_at: string | null
}

type ResourcesResponse = {
  items: ResourceRow[]
}

	const site = useSiteConfig()

useSeoMeta({
	  title: `Security Resources, Infographics & Guides | ${site.name}`,
  description: 'Curated security posters, infographics, cheat sheets, and practical guides. Free references for security teams, students, and practitioners.',
	  ogTitle: `Security Resources, Infographics & Guides | ${site.name}`,
  ogDescription: 'Curated security posters, infographics, cheat sheets, and practical guides. Free references for security teams, students, and practitioners.',
	  ogImage: site.ogImageUrl,
	  ogUrl: `${site.url}/resources`,
  ogType: 'website',
  twitterCard: 'summary_large_image',
	  twitterTitle: `Security Resources, Infographics & Guides | ${site.name}`,
  twitterDescription: 'Curated security posters, infographics, cheat sheets, and practical guides. Free references for security teams, students, and practitioners.',
	  twitterImage: site.ogImageUrl,
	  author: site.name
})

const route = useRoute()
const router = useRouter()

const categoryParam = computed(() => (typeof route.query.category === 'string' ? route.query.category : 'All'))
const selectedCategory = ref<string>(categoryParam.value || 'All')

watch(categoryParam, (v) => {
  selectedCategory.value = v || 'All'
})

const defaultCategories = ['All', 'AI Security', 'Network Security', 'Cloud Security', 'Compliance', 'Incident Response', 'Best Practices']

const apiQuery = computed(() => {
  return {
    category: selectedCategory.value === 'All' ? undefined : selectedCategory.value,
    limit: 200,
    offset: 0
  }
})

const { data, pending } = await useFetch<ResourcesResponse>('/api/resources', { query: apiQuery, watch: [apiQuery] })

const items = computed(() => (Array.isArray(data.value?.items) ? data.value!.items : []))

const categories = computed(() => {
  const dynamic = new Set<string>()
  for (const r of items.value) {
    const c = (r.category || '').trim()
    if (c) dynamic.add(c)
  }
  const merged = ['All', ...defaultCategories.filter((x) => x !== 'All'), ...Array.from(dynamic.values()).sort()]
  // Unique while preserving order
  const seen = new Set<string>()
  return merged.filter((x) => {
    if (seen.has(x)) return false
    seen.add(x)
    return true
  })
})

function selectCategory(c: string) {
  selectedCategory.value = c
  router.replace({
    query: {
      ...route.query,
      category: c === 'All' ? undefined : c
    }
  })
}

const featured = computed(() => items.value.find((r) => Boolean(r.featured)) || null)
const rest = computed(() => items.value.filter((r) => r.id !== featured.value?.id))

function typeLabel(t: ResourceRow['content_type']) {
  switch (t) {
    case 'poster':
      return 'Poster'
    case 'infographic':
      return 'Infographic'
    case 'cheat_sheet':
      return 'Cheat sheet'
    case 'guide':
      return 'Guide'
    default:
      return String(t || 'Resource')
  }
}

const lightboxOpen = ref(false)
const lightbox = ref<ResourceRow | null>(null)
function openLightbox(r: ResourceRow) {
  lightbox.value = r
  lightboxOpen.value = true
}
</script>

