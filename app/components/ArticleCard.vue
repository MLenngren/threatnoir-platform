
<template>
  <article
    v-if="!hidden"
	    class="group relative rounded-2xl bg-tn-surface-low/70 p-5 backdrop-blur-md ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-950/20 border-l-4"
	    :class="accentBorderClass"
  >
	    <div class="flex items-start justify-between gap-3">
	      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
	            class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10"
          >
            {{ article.category?.name ?? 'Uncategorized' }}
          </span>
						<a
							v-if="isUpdate && parentUrl"
							:href="safeHref(parentUrl)"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-0.5 text-[10px] font-semibold text-tn-primary ring-1 ring-tn-primary/20 hover:brightness-110"
							:title="parentTitle ? `Update — previous coverage: ${parentTitle}` : 'Update — previous coverage'"
						>
							Update
						</a>
						<span
							v-else-if="isUpdate"
							class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-0.5 text-[10px] font-semibold text-tn-primary ring-1 ring-tn-primary/20"
							title="Update"
						>
							Update
						</span>
			          <NuxtLink
			            v-if="hasAwareness"
			            to="/awareness"
			            class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20 hover:brightness-110"
			            title="Awareness Lessons available"
			          >
		            <UIcon name="i-heroicons-light-bulb" class="mr-1 h-3.5 w-3.5" />
			            Awareness Lessons
		          </NuxtLink>
	          <span
	            v-if="iocCount > 0"
			            class="inline-flex items-center rounded-full bg-tn-primary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary ring-1 ring-tn-primary/20"
	            title="Indicators of Compromise extracted from this article"
	          >
	            {{ iocCount }} IOCs
	          </span>
		          <NuxtLink
		            v-for="t in displayTags"
		            :key="t.slug"
		            :to="`/tag/${t.slug}`"
		            class="inline-flex items-center rounded-full bg-tn-surface-lowest/50 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/5"
		          >
		            {{ t.name }}
		          </NuxtLink>
	          <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
            {{ timeAgo }}
          </span>
        </div>

        <a
	      class="mt-2 block text-balance text-base font-semibold leading-snug text-tn-on-surface transition-colors group-hover:text-tn-primary"
	      :href="safeHref(article.url)"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ article.title }}
        </a>
      </div>

	      <ClientOnly>
	        <UDropdownMenu v-if="user" :items="adminMenuItems">
	          <UButton
	            icon="i-heroicons-ellipsis-vertical"
	            variant="ghost"
	            color="neutral"
	            size="xs"
	            :disabled="adminBusy"
	          />
	        </UDropdownMenu>
	      </ClientOnly>
    </div>

	    <p class="mt-3 line-clamp-3 text-sm leading-6 text-tn-on-surface-variant">
      {{ summaryText }}
    </p>

	    <div class="mt-4 flex items-center justify-between gap-3">
	      <div class="flex min-w-0 items-center gap-2 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
        <img
          v-if="sourceFavicon"
          :src="sourceFavicon"
          alt=""
          class="h-4 w-4 rounded"
          loading="lazy"
          referrerpolicy="no-referrer"
        >
        <span class="truncate">{{ article.source?.name ?? 'Source' }}</span>
      </div>

	      <NuxtLink
	        v-if="article.slug"
	        :to="`/article/${article.slug}`"
	        class="shrink-0 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:text-tn-primary hover:ring-tn-primary/30"
	        :title="`Open ${site.name} view`"
	      >
	        {{ site.name }} view
	      </NuxtLink>
    </div>
  </article>
</template>

<script setup>
import { useTimeAgo } from '@vueuse/core'
		import { safeHref } from '~/composables/useSafeHref'

	const isClient = import.meta.client
		const site = useSiteConfig()

const props = defineProps({
  article: {
    type: Object,
    required: true
  }
})

	const emit = defineEmits(['admin-action'])
	const user = useSupabaseUser()

	const hidden = ref(false)
	const adminBusy = ref(false)
	const localStatus = ref(props.article.status ?? null)
	watch(
	  () => props.article.status,
	  (v) => {
	    localStatus.value = v ?? null
	  }
	)

	function getErrorMessage(e) {
	  if (e && typeof e === 'object') {
	    const obj = e
	    const data = obj.data
	    if (data && typeof data === 'object') {
	      const statusMessage = data.statusMessage
	      if (typeof statusMessage === 'string' && statusMessage) return statusMessage
	    }
	    if (typeof obj.message === 'string' && obj.message) return obj.message
	  }
	  return 'Unknown error'
	}

	async function toggleStatus() {
	  if (adminBusy.value) return
	  adminBusy.value = true
	  try {
	    const nextStatus = localStatus.value === 'approved' ? 'rejected' : 'approved'
	    await $fetch(`/api/admin/articles/${props.article.id}`, {
	      method: 'PATCH',
	      body: { status: nextStatus }
	    })
	    localStatus.value = nextStatus
	    emit('admin-action', { id: props.article.id, action: 'status', status: nextStatus })
	    if (nextStatus !== 'approved') hidden.value = true
	  } catch (e) {
	    console.error(e)
	    if (isClient) alert(getErrorMessage(e))
	  } finally {
	    adminBusy.value = false
	  }
	}

	async function deleteArticle() {
	  if (adminBusy.value) return
	  if (!confirm('Delete this article? This cannot be undone.')) return
	
	  adminBusy.value = true
	  try {
	    await $fetch(`/api/admin/articles/${props.article.id}`, { method: 'DELETE' })
	    hidden.value = true
	    emit('admin-action', { id: props.article.id, action: 'delete' })
	  } catch (e) {
	    console.error(e)
	    if (isClient) alert(getErrorMessage(e))
	  } finally {
	    adminBusy.value = false
	  }
	}

	const adminMenuItems = computed(() => {
	  return [
	    [
	      {
	        label: 'Reject',
	        icon: 'i-heroicons-x-circle',
	        disabled: adminBusy.value,
	        onSelect: () => toggleStatus()
	      },
	      {
	        label: 'Delete',
	        icon: 'i-heroicons-trash',
	        disabled: adminBusy.value,
	        onSelect: () => deleteArticle()
	      }
	    ]
	  ]
	})

	const avgScore = ref(props.article.avg_score ?? null)
	const scoreCount = ref(props.article.score_count ?? 0)
	watch(
	  () => props.article.avg_score,
	  (v) => {
	    avgScore.value = v ?? null
	  }
	)
	watch(
	  () => props.article.score_count,
	  (v) => {
	    if (typeof v === 'number') scoreCount.value = v
	  }
	)

const summaryText = computed(() => {
  return (props.article.ai_summary || props.article.summary || '').trim()
})

		const displayTags = computed(() => {
		  const primarySlug = props.article?.category?.slug
		  const tags = Array.isArray(props.article?.tags) ? props.article.tags : []
		  return tags.filter((t) => t && t.slug && t.slug !== primarySlug)
		})

			const accentBorderClass = computed(() => {
			  const slug = String(props.article?.category?.slug ?? '').toLowerCase()
			  if (!slug) return 'border-l-tn-primary/60'

			  if (slug.includes('ransomware') || slug.includes('malware')) return 'border-l-red-500/70'
			  if (slug.includes('phishing')) return 'border-l-cyan-400/70'
			  if (slug.includes('vulnerabilities') || slug.includes('zero-day')) return 'border-l-amber-400/70'
			  if (slug.includes('breaches')) return 'border-l-fuchsia-400/70'
			  if (slug.includes('cloud')) return 'border-l-sky-400/70'
			  if (slug.includes('compliance') || slug.includes('policy') || slug.includes('gdpr') || slug.includes('nis2') || slug.includes('dora') || slug.includes('pci')) {
			    return 'border-l-violet-400/70'
			  }

			  return 'border-l-tn-primary/60'
			})

const dateValue = computed(() => {
  const d = props.article.published_at || props.article.ingested_at
  return d ? new Date(d) : new Date()
})

const timeAgo = useTimeAgo(dateValue)

	const visitorHashKey = 'tn_visitor_hash'
	const visitorHash = ref(null)
	const rateOpen = ref(false)

const sourceFavicon = computed(() => {
  const sourceUrl = props.article.source?.url
  if (!sourceUrl) return null
  try {
    const host = new URL(sourceUrl).hostname
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return null
  }
})

function getOrCreateVisitorHash() {
	  if (!isClient) return null
  const existing = localStorage.getItem(visitorHashKey)
  if (existing) return existing
  const next = crypto.randomUUID()
  localStorage.setItem(visitorHashKey, next)
  return next
}

	onMounted(() => {
	  visitorHash.value = getOrCreateVisitorHash()
	})

	const avgScoreText = computed(() => {
	  if (avgScore.value === null || avgScore.value === undefined) return null
	  const n = typeof avgScore.value === 'number' ? avgScore.value : Number.parseFloat(String(avgScore.value))
	  if (!Number.isFinite(n)) return null
	  return n.toFixed(1)
	})

	function openRating() {
	  if (!isClient) return
	  if (!visitorHash.value) visitorHash.value = getOrCreateVisitorHash()
	  if (!visitorHash.value) return
	  rateOpen.value = true
	}

	function onRated(payload) {
	  avgScore.value = payload.avg_score
	  scoreCount.value = payload.score_count
	}

		// Keep rating state/helpers defined for potential re-enable later (no UI references on feed cards).
		const _ratingDormant = { avgScoreText, openRating, onRated }

			const iocCount = computed(() => {
			  const raw = props.article?.ioc_count
			  const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
			  return Number.isFinite(n) ? Math.max(0, n) : 0
			})

				const hasAwareness = computed(() => {
				  if (!props.article) return false
				  const val = props.article.has_awareness_lesson
				  const lid = props.article.awareness_lesson_id
				  return val === true || (typeof lid === 'string' && !!lid.trim())
				})

				const isUpdate = computed(() => {
					const pid = props.article?.parent_article_id
					return typeof pid === 'string' && !!pid.trim()
				})

				const parentUrl = computed(() => {
					const p = props.article?.parent_article
					const url = p && typeof p === 'object' ? p.url : null
					return typeof url === 'string' && url.trim() ? url : null
				})

				const parentTitle = computed(() => {
					const p = props.article?.parent_article
					const title = p && typeof p === 'object' ? p.title : null
					return typeof title === 'string' && title.trim() ? title : null
				})
</script>
