<template>
  <div class="article-edit">
    <!-- Top bar: breadcrumb + actions -->
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="mb-1 flex items-center gap-2 text-xs tracking-widest text-gray-500 uppercase">
          <NuxtLink to="/admin/articles" class="transition-colors hover:text-gray-300">Articles</NuxtLink>
          <span class="text-gray-700">/</span>
          <span class="truncate text-gray-400">Edit</span>
        </div>
        <h1 class="truncate text-xl font-bold tracking-tight text-gray-50 sm:text-2xl">
          {{ article?.title ?? 'Loading...' }}
        </h1>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UButton
          variant="outline"
          color="success"
          class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(34,197,94,0.2)]"
          :loading="statusLoading === 'approved'"
          @click="updateStatus('approved')"
        >
	          {{ approveLabel }}
        </UButton>
        <UButton
          variant="outline"
          color="warning"
          class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(234,179,8,0.2)]"
          :loading="statusLoading === 'rejected'"
          @click="updateStatus('rejected')"
        >
          Reject
        </UButton>
	        <UButton
	          variant="outline"
	          color="primary"
	          class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(99,102,241,0.2)]"
	          :loading="reprocessLoading"
	          :disabled="reprocessLoading || statusLoading !== null"
	          @click="reprocessAi"
	        >
	          Re-run AI processing
	        </UButton>
        <div class="mx-1 h-6 w-px bg-gray-800" />
        <UButton
          variant="ghost"
          color="error"
          class="cursor-pointer transition-all duration-150"
          :loading="deleting"
          @click="confirmDelete"
        >
          Delete
        </UButton>
      </div>
    </div>

    <!-- Status ribbon -->
    <div v-if="article" class="mb-6 flex flex-wrap items-center gap-3">
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
        :class="{
          'bg-emerald-950/60 text-emerald-400 ring-1 ring-emerald-800/50': article.status === 'approved',
          'bg-amber-950/60 text-amber-400 ring-1 ring-amber-800/50': article.status === 'pending',
          'bg-red-950/60 text-red-400 ring-1 ring-red-800/50': article.status === 'rejected'
        }"
      >
        <span
          class="inline-block h-1.5 w-1.5 rounded-full"
          :class="{
            'bg-emerald-400': article.status === 'approved',
            'bg-amber-400': article.status === 'pending',
            'bg-red-400': article.status === 'rejected'
          }"
        />
        {{ article.status }}
      </span>
      <span class="text-xs text-gray-600">|</span>
      <span class="font-mono text-xs text-gray-400">{{ article.source?.name ?? '—' }}</span>
      <span class="text-xs text-gray-600">|</span>
      <span class="font-mono text-xs text-gray-400">{{ currentCategoryName }}</span>
      <span class="text-xs text-gray-600">|</span>
      <span class="font-mono text-xs text-gray-400">{{ fmtRating(article.avg_score, article.score_count) }}</span>
	      <span class="text-xs text-gray-600">|</span>
	      <span
	        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
	        :class="relevanceClass(article.relevance_score)"
	      >
	        Relevance: {{ fmtRelevance(article.relevance_score) }}
	      </span>
    </div>

    <!-- Two-section layout -->
    <div class="space-y-8">
      <!-- Fields -->
      <section>
        <div class="mb-4 flex items-center gap-3">
          <div class="h-px grow bg-gradient-to-r from-gray-800 to-transparent" />
          <span class="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">Edit Fields</span>
          <div class="h-px grow bg-gradient-to-l from-gray-800 to-transparent" />
        </div>

        <div class="rounded-xl border border-gray-800/80 bg-gray-950/40 p-6 backdrop-blur-sm">
          <div class="mb-6">
            <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Category</label>
            <USelect v-model.nullable="form.category_id" :items="categoryOptions" class="w-full" />
          </div>

	          <div class="mb-6">
	            <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Tags</label>
	            <div v-if="displayTagCategories.length" class="mb-2 flex flex-wrap gap-2">
	              <span
	                v-for="t in displayTagCategories"
	                :key="t.id"
	                class="inline-flex items-center rounded-full border border-gray-800 bg-black/20 px-2 py-0.5 text-[11px] font-medium text-gray-300"
	              >
	                {{ t.name }}
	              </span>
	            </div>
	            <div class="flex flex-wrap gap-2">
	              <button
	                v-for="c in categories"
	                :key="c.id"
	                type="button"
	                class="rounded-full border px-2 py-1 text-[11px] font-semibold"
	                :class="form.tag_ids.includes(c.id)
	                  ? 'border-indigo-700 bg-indigo-950/40 text-indigo-200'
	                  : 'border-gray-800 bg-gray-950 text-gray-400 hover:bg-gray-900/30'"
	                @click="toggleTag(c.id)"
	              >
	                {{ c.name }}
	              </button>
	            </div>
	            <p class="mt-1.5 text-[11px] text-gray-600">Primary category is set above; tags are additional labels.</p>
	          </div>

          <div class="mb-6">
            <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Summary</label>
            <UTextarea
              v-model="form.summary"
              :rows="6"
              placeholder="Short human-written summary..."
              class="w-full"
            />
            <p class="mt-1.5 text-[11px] text-gray-600">Visible on the public article card</p>
          </div>

          <div class="mb-8">
            <label class="mb-2 block text-xs font-semibold tracking-wider text-gray-400 uppercase">AI Summary</label>
            <UTextarea
              v-model="form.ai_summary"
              :rows="10"
              placeholder="AI-generated summary..."
              class="w-full"
            />
            <p class="mt-1.5 text-[11px] text-gray-600">Auto-generated, editable before publishing</p>
          </div>

          <div class="flex items-center gap-3 border-t border-gray-800/60 pt-5">
            <UButton
              class="cursor-pointer px-6 transition-all duration-150 hover:shadow-[0_0_16px_rgba(99,102,241,0.15)]"
              :loading="saving"
              @click="save"
            >
              Save changes
            </UButton>
            <UButton color="neutral" variant="ghost" class="cursor-pointer" :loading="loading" @click="reload">
              Reload
            </UButton>
          </div>
        </div>
      </section>

      <!-- Preview -->
      <section>
        <div class="mb-4 flex items-center gap-3">
          <div class="h-px grow bg-gradient-to-r from-gray-800 to-transparent" />
          <span class="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">Preview</span>
          <div class="h-px grow bg-gradient-to-l from-gray-800 to-transparent" />
        </div>

        <div class="rounded-xl border border-gray-800/80 bg-gray-950/40 p-6 backdrop-blur-sm">
          <div v-if="article">
            <div class="mb-5 flex items-start justify-between gap-4">
              <h2 class="text-lg font-bold leading-snug text-gray-100">{{ article.title }}</h2>
              <UButton
	                v-if="safeHref(article.url) !== '#'"
                color="neutral"
                variant="outline"
                size="xs"
                class="shrink-0 cursor-pointer"
	                :to="safeHref(article.url)"
                target="_blank"
              >
                Open original &nearr;
              </UButton>
            </div>

            <div class="space-y-5">
              <div>
                <div class="mb-1.5 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Summary</div>
                <div class="whitespace-pre-wrap rounded-lg border border-gray-800/50 bg-black/30 p-4 text-sm leading-relaxed text-gray-300">
                  {{ form.summary || '—' }}
                </div>
              </div>

              <div>
                <div class="mb-1.5 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">AI Summary</div>
                <div class="whitespace-pre-wrap rounded-lg border border-gray-800/50 bg-black/30 p-4 text-sm leading-relaxed text-gray-300">
                  {{ form.ai_summary || '—' }}
                </div>
              </div>
            </div>
          </div>

          <div v-else class="flex items-center justify-center py-12">
            <div class="text-sm text-gray-500">Loading article...</div>
          </div>
        </div>
      </section>

	      <!-- IOCs -->
	      <section>
	        <div class="mb-4 flex items-center gap-3">
	          <div class="h-px grow bg-gradient-to-r from-gray-800 to-transparent" />
	          <span class="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">IOCs</span>
	          <div class="h-px grow bg-gradient-to-l from-gray-800 to-transparent" />
	        </div>

	        <div class="rounded-xl border border-gray-800/80 bg-gray-950/40 p-6 backdrop-blur-sm">
	          <!-- Add IOC form -->
	          <div class="mb-5 rounded-lg border border-gray-800/40 bg-black/20 p-4">
	            <div class="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">Add IOC</div>
	            <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
	              <div class="w-full sm:w-36">
	                <label class="mb-1 block text-[11px] text-gray-500">Type</label>
	                <select
	                  v-model="newIoc.type"
	                  class="w-full rounded-md border border-gray-800 bg-gray-950 px-2 py-1.5 text-xs text-gray-200"
	                >
	                  <option v-for="t in iocTypes" :key="t" :value="t">{{ t }}</option>
	                </select>
	              </div>
	              <div class="min-w-0 grow">
	                <label class="mb-1 block text-[11px] text-gray-500">Value</label>
	                <input
	                  v-model="newIoc.value"
	                  type="text"
	                  placeholder="e.g. CVE-2026-1234, 192.168.1.1, evil.com"
	                  class="w-full rounded-md border border-gray-800 bg-gray-950 px-2 py-1.5 font-mono text-xs text-gray-200 placeholder:text-gray-600"
	                >
	              </div>
	              <div class="min-w-0 grow">
	                <label class="mb-1 block text-[11px] text-gray-500">Context (optional)</label>
	                <input
	                  v-model="newIoc.context"
	                  type="text"
	                  placeholder="e.g. C2 server, phishing domain"
	                  class="w-full rounded-md border border-gray-800 bg-gray-950 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600"
	                >
	              </div>
	              <UButton
	                size="xs"
	                class="shrink-0 cursor-pointer"
	                :disabled="!newIoc.value.trim()"
	                :loading="addingIoc"
	                @click="addIoc"
	              >
	                Add
	              </UButton>
	            </div>
	          </div>

	          <div v-if="!iocs.length" class="text-sm text-gray-500">
	            No IOCs extracted for this article.
	          </div>

	          <div v-else class="space-y-3">
	            <div
	              v-for="ioc in iocs"
	              :key="ioc.id"
	              class="rounded-lg border border-gray-800/60 bg-black/20 p-4"
	            >
	              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	                <div class="min-w-0">
	                  <div class="mb-2 flex flex-wrap items-center gap-2">
	                    <span
	                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
	                      :class="iocTypeClass(ioc.type)"
	                    >
	                      {{ ioc.type }}
	                    </span>
	                    <code class="truncate rounded border border-gray-800/50 bg-black/30 px-2 py-1 font-mono text-xs text-gray-200">
	                      {{ ioc.value }}
	                    </code>
	                  </div>
	                  <div v-if="ioc.context" class="text-xs leading-relaxed text-gray-400">
	                    {{ ioc.context }}
	                  </div>
	                </div>

	                <div class="flex shrink-0 items-center gap-2">
	                  <UButton
	                    color="neutral"
	                    variant="outline"
	                    size="xs"
	                    icon="i-heroicons-clipboard-document"
	                    class="cursor-pointer"
	                    @click="copyIoc(ioc.value)"
	                  >
	                    Copy
	                  </UButton>
	                  <UButton
	                    color="error"
	                    variant="outline"
	                    size="xs"
	                    icon="i-heroicons-trash"
	                    class="cursor-pointer"
	                    @click="deleteIoc(ioc.id)"
	                  >
	                    Delete
	                  </UButton>
	                </div>
	              </div>
	            </div>
	          </div>
	        </div>
	      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'
import { safeHref } from '~/composables/useSafeHref'

definePageMeta({ layout: 'admin' })

type Category = { id: string; name: string; slug: string }
	type ArticleTagRow = { category_id: string; category?: Category | null }
type ArticleDetail = {
  id: string
  title: string
  url: string
  status: 'pending' | 'approved' | 'rejected'
	  relevance_score: number | null
	  avg_score: number | string | null
	  score_count: number
  published_at: string | null
  ingested_at: string
  summary: string | null
  ai_summary: string | null
  category_id: string | null
  source?: { id: string; name: string } | null
  category?: { id: string; name: string; slug: string } | null
	  article_tags?: ArticleTagRow[]
}

type ArticleIoc = {
  id: string
  type: string
  value: string
  context: string | null
  created_at: string
}

const route = useRoute()
const id = computed(() => String(route.params.id))

const loading = ref(false)
const saving = ref(false)
const statusLoading = ref<'approved' | 'rejected' | null>(null)
	const reprocessLoading = ref(false)
const deleting = ref(false)

const article = ref<ArticleDetail | null>(null)
const categories = ref<Category[]>([])

const iocs = ref<ArticleIoc[]>([])

	const form = reactive<{ category_id: string | null; summary: string | null; ai_summary: string | null; tag_ids: string[] }>({
  category_id: null,
  summary: null,
	  ai_summary: null,
	  tag_ids: []
})

	const selectedTagCategories = computed(() => {
	  const selected = new Set(form.tag_ids)
	  return categories.value.filter((c) => selected.has(c.id))
	})

	const displayTagCategories = computed(() => {
	  return selectedTagCategories.value.filter((c) => c.id !== form.category_id)
	})

	function toggleTag(categoryId: string) {
	  const i = form.tag_ids.indexOf(categoryId)
	  if (i >= 0) {
	    form.tag_ids = [...form.tag_ids.slice(0, i), ...form.tag_ids.slice(i + 1)]
	    return
	  }
	  form.tag_ids = [...form.tag_ids, categoryId]
	}

const categoryOptions = computed(() => {
  return [{ label: 'Uncategorized', value: null }, ...categories.value.map((c) => ({ label: c.name, value: c.id }))]
})

const currentCategoryName = computed(() => {
  const found = categories.value.find((c) => c.id === form.category_id)
  return found?.name ?? 'Uncategorized'
})

function fmtRating(avgScore: number | string | null, count: number) {
  if (!count) return 'Not rated'
  const n = typeof avgScore === 'number' ? avgScore : Number.parseFloat(String(avgScore))
  const avg = Number.isFinite(n) ? n.toFixed(1) : '—'
  return `${avg}/10 (${count} ${count === 1 ? 'rating' : 'ratings'})`
}

function fmtRelevance(score: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '—'
  return String(score)
}

function relevanceClass(score: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'bg-gray-950/60 text-gray-300 ring-1 ring-gray-800/50'
  if (score >= 8) return 'bg-emerald-950/60 text-emerald-400 ring-1 ring-emerald-800/50'
  if (score >= 5) return 'bg-amber-950/60 text-amber-400 ring-1 ring-amber-800/50'
  return 'bg-red-950/60 text-red-400 ring-1 ring-red-800/50'
}

const supabase = useSupabaseClient()
	const toast = useToast()

	const approveLabel = computed(() => {
	  if (statusLoading.value !== 'approved') return 'Approve'
	  // If approving an article that has no AI summary yet, backend will do inline AI processing.
	  return article.value?.ai_summary == null ? 'Processing AI…' : 'Approving…'
	})

async function load() {
  loading.value = true
  try {
	    const [{ data: a, error: aErr }, { data: c, error: cErr }, { data: i, error: iErr }] = await Promise.all([
      supabase
        .from('articles')
        .select(
	          `id,title,url,status,relevance_score,avg_score,score_count,published_at,ingested_at,
          summary,ai_summary,category_id,
          source:sources ( id,name ),
	          category:categories!articles_category_id_fkey ( id,name,slug ),
	          article_tags ( category_id, category:categories!article_tags_category_id_fkey ( id,name,slug ) )`
        )
        .eq('id', id.value)
        .single(),
	      supabase.from('categories').select('id,name,slug').order('sort_order', { ascending: true }),
	      supabase
	        .from('article_iocs')
	        .select('id,type,value,context,created_at')
	        .eq('article_id', id.value)
	        .order('created_at', { ascending: false })
    ])

    if (aErr) {
      console.error('Failed to load article:', aErr)
      return
    }
    if (cErr) {
      console.error('Failed to load categories:', cErr)
      return
    }
	    if (iErr) {
	      console.error('Failed to load IOCs:', iErr)
	      // Non-fatal; keep page usable.
	    }

    article.value = a as unknown as ArticleDetail
    categories.value = (c ?? []) as unknown as Category[]
	    iocs.value = (i ?? []) as unknown as ArticleIoc[]

    form.category_id = article.value.category_id
    form.summary = article.value.summary
    form.ai_summary = article.value.ai_summary
	    form.tag_ids = Array.from(
	      new Set(
	        (article.value.article_tags ?? [])
	          .map((t) => t?.category_id)
	          .filter((v): v is string => typeof v === 'string' && !!v)
	      )
	    )
  } finally {
    loading.value = false
  }
}

function iocTypeClass(type: string) {
  const t = (type || '').toLowerCase()
  if (t === 'cve') return 'bg-red-950/60 text-red-300 ring-1 ring-red-800/50'
  if (t === 'ip') return 'bg-orange-950/60 text-orange-300 ring-1 ring-orange-800/50'
  if (t === 'domain') return 'bg-yellow-950/60 text-yellow-300 ring-1 ring-yellow-800/50'
  if (t.startsWith('hash_')) return 'bg-sky-950/60 text-sky-300 ring-1 ring-sky-800/50'
  if (t === 'url') return 'bg-teal-950/60 text-teal-300 ring-1 ring-teal-800/50'
  if (t === 'malware') return 'bg-purple-950/60 text-purple-300 ring-1 ring-purple-800/50'
  if (t === 'mitre_attack') return 'bg-fuchsia-950/60 text-fuchsia-300 ring-1 ring-fuchsia-800/50'
  if (t === 'email') return 'bg-indigo-950/60 text-indigo-300 ring-1 ring-indigo-800/50'
  return 'bg-gray-900/60 text-gray-300 ring-1 ring-gray-800/50'
}

async function copyIoc(value: string) {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(value)
	    useToast().show('Copied')
  } catch {
	    useToast().show('Copy failed', 'error')
    // Fallback for restrictive browsers
    window.prompt('Copy IOC value:', value)
  }
}

const iocTypes = ['cve', 'ip', 'domain', 'hash_md5', 'hash_sha1', 'hash_sha256', 'url', 'mitre_attack', 'email', 'malware']
const newIoc = reactive({ type: 'cve', value: '', context: '' })
const addingIoc = ref(false)

async function addIoc() {
  if (!newIoc.value.trim()) return
  addingIoc.value = true
  try {
    const { data, error } = await supabase
      .from('article_iocs')
      .insert({
        article_id: id.value,
        type: newIoc.type,
        value: newIoc.value.trim(),
        context: newIoc.context.trim() || null
      })
      .select('id,type,value,context,created_at')
      .single()

    if (error) {
      console.error('Failed to add IOC:', error)
      alert(error.message)
      return
    }
    iocs.value = [data as unknown as ArticleIoc, ...iocs.value]
    newIoc.value = ''
    newIoc.context = ''
  } finally {
    addingIoc.value = false
  }
}

async function deleteIoc(iocId: string) {
  if (!confirm('Delete this IOC?')) return
  const { error } = await supabase.from('article_iocs').delete().eq('id', iocId)
  if (error) {
    console.error('Failed to delete IOC:', error)
    return
  }
  iocs.value = iocs.value.filter((x) => x.id !== iocId)
}

onMounted(() => {
  load()
})

async function save() {
  saving.value = true
  try {
    await $fetch(`/api/admin/articles/${id.value}`, {
      method: 'PATCH',
      body: {
        category_id: form.category_id,
	        tags: form.tag_ids,
        summary: form.summary,
        ai_summary: form.ai_summary
      }
    })
    await load()
  } finally {
    saving.value = false
  }
}

async function updateStatus(status: 'approved' | 'rejected') {
  statusLoading.value = status
	  const needsAi = status === 'approved' && article.value?.ai_summary == null
  try {
	    const res = await $fetch<{ article: unknown; ai_processed?: boolean }>(`/api/admin/articles/${id.value}`, {
      method: 'PATCH',
      body: { status }
    })
	    if (needsAi) {
	      if (res.ai_processed === true) {
	        toast.show('Approved + AI processing complete', 'success')
	      } else if (res.ai_processed === false) {
	        toast.show('Approved (AI processing failed — try the Re-run button)', 'info')
	      }
	    }
    await load()
	  } catch (e) {
	    const msg = e instanceof Error ? e.message : String(e)
	    toast.show(msg || 'Failed to update status', 'error')
  } finally {
    statusLoading.value = null
  }
}

	async function reprocessAi() {
	  reprocessLoading.value = true
	  try {
	    await $fetch(`/api/admin/articles/${id.value}/reprocess`, { method: 'POST' })
	    toast.show('AI processing complete', 'success')
	    await load()
	  } catch (e) {
	    const msg = e instanceof Error ? e.message : String(e)
	    toast.show(msg || 'AI processing failed', 'error')
	  } finally {
	    reprocessLoading.value = false
	  }
	}

async function reload() {
  await load()
}

async function confirmDelete() {
  if (!confirm('Delete this article? This cannot be undone.')) return

  deleting.value = true
  try {
    await $fetch(`/api/admin/articles/${id.value}`, { method: 'DELETE' })
    await navigateTo('/admin/articles')
  } finally {
    deleting.value = false
  }
}
</script>
