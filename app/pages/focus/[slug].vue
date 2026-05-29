<template>
  <main class="-mt-6 -mx-6 min-h-[calc(100dvh-5rem)] bg-[#0e131f] p-6 text-white">
    <div class="mx-auto max-w-5xl">
      <header class="flex flex-col gap-4 border-b border-[#1e293b] pb-6">
        <NuxtLink to="/focus" class="inline-flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white">
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to advisories
        </NuxtLink>

        <div>
          <h1 class="text-balance text-2xl font-black tracking-tight md:text-4xl">{{ item?.title || 'Focus alert' }}</h1>
          <p v-if="item?.summary" class="mt-2 max-w-3xl text-sm text-[#94a3b8] md:text-base">{{ item.summary }}</p>
        </div>
      </header>

      <section v-if="item" class="mt-8">
        <article class="rounded-2xl border border-[#1e293b] bg-[#161c28] p-5 md:p-6" :class="cardBorderClass(item.severity)">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" :class="severityBadgeClass(item.severity)">
              {{ item.severity.toUpperCase() }}
            </span>
            <span class="rounded-full border border-[#1e293b] bg-[#161c28] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
              {{ categoryLabel(item.category) }}
            </span>
            <span class="font-label text-[10px] uppercase tracking-widest text-[#64748b]">{{ dateLabel(item.created_at) }}</span>
          </div>

          <div v-if="item.action_required" class="mt-5 flex items-start gap-3 rounded-lg border border-red-500/25 bg-[#0e131f] px-4 py-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-[#ef4444]" />
            <div class="min-w-0">
              <div class="text-xs font-bold uppercase tracking-widest text-[#ef4444]">Action required</div>
              <div class="mt-1 text-sm font-semibold text-white">{{ item.action_required }}</div>
            </div>
          </div>

          <div v-if="(item.affected_products ?? []).length" class="mt-5">
            <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Affected products</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <span v-for="p in item.affected_products" :key="p" class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
                {{ p }}
              </span>
            </div>
          </div>

          <div v-if="(item.cve_ids ?? []).length" class="mt-5">
            <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">CVE IDs</div>
            <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <a
                v-for="cve in item.cve_ids"
                :key="cve"
                :href="`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-bold text-[#4cd7f6] hover:underline"
              >
                {{ cve }}
              </a>
            </div>
          </div>

          <div v-if="(item.articles ?? []).length" class="mt-6">
            <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Linked articles</div>
            <ul class="mt-2 space-y-1 text-sm">
              <li v-for="a in item.articles" :key="a.id">
                <a
                  :href="safeHref(a.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-[#4cd7f6] hover:underline"
                >
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3.5 w-3.5 shrink-0" />
                  {{ a.title }}
                </a>
              </li>
            </ul>
          </div>

          <div v-if="(item.source_urls ?? []).length" class="mt-6">
            <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Source links</div>
            <ul class="mt-2 space-y-1 text-sm">
              <li v-for="(u, idx) in item.source_urls" :key="idx">
                <a
                  :href="safeHref(u)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-[#4cd7f6] hover:underline"
                >
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3.5 w-3.5 shrink-0" />
                  {{ u }}
                </a>
              </li>
            </ul>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

type FocusSeverity = 'critical' | 'high' | 'medium'

type FocusItem = {
  id: string
  title: string
  slug: string
  summary: string
  severity: FocusSeverity
  category: string
  cve_ids: string[]
  affected_products: string[]
  action_required: string | null
  ioc_summary: string | null
  source_urls: string[]
  status: 'active' | 'archived'
  expires_at: string | null
  created_at: string
  updated_at: string
  articles: Array<{ id: string; title: string; url: string }>
}

type FocusBySlugResponse = { item: FocusItem }

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim())

const { data, error } = await useFetch<FocusBySlugResponse>(() => `/api/focus/${encodeURIComponent(slug.value)}`, {
  key: () => `focus:${slug.value}`,
  watch: [slug]
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Focus item not found'
  })
}

const item = computed(() => data.value?.item || null)
	const site = useSiteConfig()

	const seoTitle = computed(() => (item.value?.title ? `${item.value.title} — Focus alert | ${site.name}` : `Focus alert | ${site.name}`))
const seoDescription = computed(() => {
  const raw = (item.value?.summary || '').trim()
	  if (!raw) return `Urgent security threat advisory from ${site.name}.`
  return raw.length <= 155 ? raw : raw.slice(0, 155).trim() + '…'
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'article'
})

function severityBadgeClass(s: FocusSeverity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (s === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/25'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
}

function cardBorderClass(s: FocusSeverity): string {
  if (s === 'critical') return 'border-red-500/25'
  if (s === 'high') return 'border-orange-500/25'
  return 'border-yellow-500/25'
}

function categoryLabel(c: string) {
  const v = String(c || '').trim().toLowerCase()
  if (v === 'cve') return 'CVE'
  if (v === 'breach') return 'Breach'
  if (v === 'exploit') return 'Exploit'
  if (v === 'campaign') return 'Campaign'
  if (v === 'advisory') return 'Advisory'
  return v || 'Focus'
}

function dateLabel(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return '—'
  }
}
</script>
