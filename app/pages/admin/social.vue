<template>
  <div class="-m-6 min-h-full bg-[#0e131f] p-6 text-white">
    <!-- Toast -->
    <div
      v-if="toast.open"
      class="fixed right-4 top-4 z-[80] w-[min(420px,calc(100vw-2rem))] rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur"
      :class="toastClass"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-medium">{{ toast.title }}</div>
          <div v-if="toast.message" class="mt-1 text-[#94a3b8]">{{ toast.message }}</div>
        </div>
        <button type="button" class="text-[#94a3b8] hover:text-white" @click="toast.open = false">×</button>
      </div>
    </div>

    <!-- Header row -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Social Posts</h1>
        <p class="mt-1 text-sm text-[#94a3b8]">Manage AI-generated drafts for X and LinkedIn.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black transition hover:brightness-110 disabled:opacity-60"
          :disabled="generating"
          @click="generateDraft"
        >
          <span v-if="generating" class="inline-flex items-center gap-2">
            <span class="h-3 w-3 animate-spin rounded-full border-2 border-black/40 border-t-black" />
            Generating…
          </span>
          <span v-else>Generate Draft</span>
        </button>

        <button
          type="button"
          class="rounded-lg border border-[#1e293b] bg-[#161c28] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 hover:bg-[#1a2231]"
          :disabled="pending"
          @click="refresh"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Article picker -->
    <div class="mt-6 rounded-lg border border-[#1e293b] bg-[#161c28]">
      <button
        type="button"
        class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white hover:bg-[#1a2231]"
        @click="pickerOpen = !pickerOpen"
      >
        <span>Select Articles for Draft {{ selectedArticles.size > 0 ? `(${selectedArticles.size} selected)` : '' }}</span>
        <UIcon :name="pickerOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4 text-[#94a3b8]" />
      </button>

      <div v-if="pickerOpen" class="border-t border-[#1e293b] px-4 py-3 space-y-2">
        <div v-if="loadingArticles" class="text-sm text-[#94a3b8]">Loading articles...</div>
        <div v-else-if="recentArticles.length === 0" class="text-sm text-[#94a3b8]">No recent articles found.</div>
        <template v-else>
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs text-[#94a3b8]">Recent approved articles (last 12h)</span>
            <button
              v-if="selectedArticles.size > 0"
              type="button"
              class="text-xs text-[#94a3b8] hover:text-white"
              @click="selectedArticles.clear()"
            >
              Clear selection
            </button>
          </div>
          <label
            v-for="a in recentArticles"
            :key="a.id"
            class="flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-[#0e131f]"
            :class="selectedArticles.has(a.id) ? 'bg-[#4cd7f6]/5' : ''"
          >
            <input
              type="checkbox"
              :checked="selectedArticles.has(a.id)"
              class="mt-0.5 h-4 w-4 rounded border-[#1e293b] bg-[#0e131f] text-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/40"
              @change="toggleArticle(a.id)"
            >
            <div class="min-w-0">
              <div class="text-sm font-medium text-white truncate">{{ a.title }}</div>
              <div class="text-xs text-[#64748b] truncate">{{ a.brief || a.ai_summary?.slice(0, 100) || '' }}</div>
            </div>
            <span class="ml-auto shrink-0 rounded bg-[#0e131f] px-1.5 py-0.5 text-[10px] font-bold text-[#94a3b8]">
              {{ a.relevance_score }}
            </span>
          </label>
          <div class="mt-3 flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black transition hover:brightness-110 disabled:opacity-60"
              :disabled="generating || selectedArticles.size === 0"
              @click="generateDraft"
            >
              <span v-if="generating" class="inline-flex items-center gap-2">
                <span class="h-3 w-3 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                Generating…
              </span>
              <span v-else>Generate from {{ selectedArticles.size }} Article{{ selectedArticles.size === 1 ? '' : 's' }}</span>
            </button>
            <span class="text-xs text-[#64748b]">or use the button above for auto-selection</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="mt-6 flex flex-wrap items-center gap-4 border-b border-[#1e293b]">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        class="relative pb-3 text-sm font-medium"
        :class="activeStatus === t.value ? 'text-white' : 'text-[#94a3b8] hover:text-white'"
        @click="setStatusTab(t.value)"
      >
        {{ t.label }}
        <span
          v-if="activeStatus === t.value"
          class="absolute bottom-0 left-0 right-0 h-[2px] rounded bg-[#4cd7f6]"
        />
      </button>
    </div>

    <!-- List -->
    <div class="mt-6 space-y-4">
      <div v-if="pending" class="rounded-lg border border-[#1e293b] bg-[#161c28] p-5 text-sm text-[#94a3b8]">
        Loading drafts…
      </div>

      <div v-else-if="drafts.length === 0" class="rounded-lg border border-[#1e293b] bg-[#161c28] p-5 text-sm text-[#94a3b8]">
        <template v-if="activeStatus === 'pending'">
          No pending drafts. Click <span class="font-medium text-white">Generate Draft</span> to create one.
        </template>
        <template v-else-if="activeStatus === 'posted'">No posts yet.</template>
        <template v-else>No drafts found.</template>
      </div>

      <article
        v-for="d in drafts"
        :key="d.id"
        class="rounded-xl border border-[#1e293b] bg-[#161c28] p-5"
      >
        <!-- Card header row -->
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-sm text-[#94a3b8]">
            {{ fmtDateTime(d.created_at) }}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="badgeClass(d.status)">
              {{ d.status }}
            </span>

            <template v-if="d.status === 'posted' && d.posted_url">
              <a
                :href="d.posted_url"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-2 rounded-lg border border-[#1e293b] bg-black/20 px-3 py-1 text-xs text-[#4cd7f6] hover:bg-black/30"
                title="Open posted X link"
              >
                View post
                <span class="text-[#94a3b8]">↗</span>
              </a>
              <span v-if="d.posted_at" class="text-xs text-[#94a3b8]">Posted {{ fmtDateTime(d.posted_at) }}</span>
            </template>
          </div>
        </div>

        <!-- Two-column layout -->
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Left: X -->
          <section class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <div class="text-sm font-semibold">X / Twitter</div>
                <span
                  class="rounded-full border border-[#1e293b] bg-black/20 px-2 py-0.5 text-xs"
                  :class="xLen(d) > 280 ? 'text-red-300' : 'text-[#94a3b8]'"
                >
                  {{ xLen(d) }}/280
                </span>
              </div>

              <span v-if="savedPulse?.id === d.id && savedPulse?.field === 'text_x'" class="text-xs text-[#22c55e]">Saved</span>
            </div>

            <div
              v-if="isEditing(d.id, 'text_x')"
              class="rounded-lg border border-[#1e293b] bg-[#0e131f] p-3"
            >
              <textarea
                v-model="editText"
                class="min-h-28 w-full resize-y bg-transparent text-sm text-white outline-none placeholder:text-[#94a3b8]"
                placeholder="Write X post…"
                @keydown.ctrl.enter.prevent="saveEdit()"
                @blur="saveEdit()"
              />
              <div class="mt-2 flex items-center justify-between text-xs text-[#94a3b8]">
                <span>{{ editText.length }}/280</span>
                <span v-if="savingEdit" class="inline-flex items-center gap-2">
                  <span class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </span>
              </div>
            </div>

            <button
              v-else
              type="button"
              class="w-full rounded-lg border border-[#1e293b] bg-[#0e131f] p-3 text-left text-sm text-white/90 hover:bg-black/20"
              @click="startEdit(d, 'text_x')"
            >
              <div class="whitespace-pre-wrap break-words">{{ d.text_x || '—' }}</div>
              <div class="mt-2 text-xs text-[#94a3b8]">Click to edit</div>
            </button>

            <button
              v-if="d.status === 'pending'"
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black transition hover:brightness-110 disabled:opacity-60"
              :disabled="approvingId === d.id"
              @click="approveDraft(d)"
            >
              <span v-if="approvingId === d.id" class="inline-flex items-center gap-2">
                <span class="h-3 w-3 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                Posting…
              </span>
              <span v-else>Approve &amp; Post to X</span>
            </button>
          </section>

          <!-- Right: LinkedIn -->
          <section class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold">LinkedIn</div>
              <span v-if="savedPulse?.id === d.id && savedPulse?.field === 'text_linkedin'" class="text-xs text-[#22c55e]">Saved</span>
            </div>

            <div
              v-if="isEditing(d.id, 'text_linkedin')"
              class="rounded-lg border border-[#1e293b] bg-[#0e131f] p-3"
            >
              <textarea
                v-model="editText"
                class="min-h-28 w-full resize-y bg-transparent text-sm text-white outline-none placeholder:text-[#94a3b8]"
                placeholder="Write LinkedIn post…"
                @keydown.ctrl.enter.prevent="saveEdit()"
                @blur="saveEdit()"
              />
              <div class="mt-2 flex items-center justify-end text-xs text-[#94a3b8]">
                <span v-if="savingEdit" class="inline-flex items-center gap-2">
                  <span class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </span>
              </div>
            </div>

            <button
              v-else
              type="button"
              class="w-full rounded-lg border border-[#1e293b] bg-[#0e131f] p-3 text-left text-sm text-white/90 hover:bg-black/20"
              @click="startEdit(d, 'text_linkedin')"
            >
              <div class="whitespace-pre-wrap break-words">
                <template v-if="(d.text_linkedin || '').trim()">
                  <template v-for="(p, idx) in linkedinParts(d.text_linkedin || '')" :key="idx">
                    <strong v-if="p.bold" class="font-semibold text-white">{{ p.text }}</strong>
                    <span v-else>{{ p.text }}</span>
                  </template>
                </template>
                <template v-else>
	                  —
                </template>
              </div>
              <div class="mt-2 text-xs text-[#94a3b8]">Click to edit</div>
            </button>

            <div class="flex items-center justify-end">
              <button
                type="button"
                class="rounded-lg border border-[#1e293b] bg-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 hover:bg-black/20"
                @click="copyLinkedIn(d)"
              >
                {{ copiedId === d.id ? 'Copied!' : 'Copy to Clipboard' }}
              </button>
            </div>
          </section>
        </div>

        <!-- Source articles + Skip -->
        <div class="mt-5 border-t border-[#1e293b] pt-4">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">Source Articles</div>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="a in d.articles" :key="a.id" class="text-white/90">
              <NuxtLink
                v-if="a.id"
                :to="`/admin/articles/${a.id}`"
                class="text-[#4cd7f6] hover:underline"
              >
                {{ a.title || a.id }}
              </NuxtLink>
              <span v-else>{{ a.title }}</span>
            </li>
          </ul>

          <div v-if="d.status === 'pending'" class="mt-4 flex items-center justify-end">
            <button
              type="button"
              class="rounded-lg border border-[#1e293b] bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#94a3b8] hover:bg-black/20 hover:text-white"
              :disabled="skippingId === d.id"
              @click="skipDraft(d)"
            >
              <span v-if="skippingId === d.id" class="inline-flex items-center gap-2">
                <span class="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                Skipping…
              </span>
              <span v-else>Skip</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'
definePageMeta({ layout: 'admin' })

type StatusTab = 'pending' | 'posted' | 'skipped' | 'all'
type EditField = 'text_x' | 'text_linkedin'

type ArticleRef = { id: string; title: string }

type SocialDraft = {
  id: string
  status: string
  text_x: string | null
  text_linkedin: string | null
  posted_url: string | null
  posted_at: string | null
  created_at: string
  articles: ArticleRef[]
}

type ListResponse = { items: SocialDraft[] }

const route = useRoute()

const tabs: Array<{ label: string; value: StatusTab }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Posted', value: 'posted' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'All', value: 'all' }
]

const activeStatus = computed<StatusTab>(() => {
  const raw = typeof route.query.status === 'string' ? route.query.status : 'pending'
  if (raw === 'posted' || raw === 'skipped' || raw === 'all' || raw === 'pending') return raw
  return 'pending'
})

const query = computed(() => ({ status: activeStatus.value }))
const { data, pending, refresh } = await useFetch<ListResponse>('/api/admin/social', { query, watch: [query] })
const drafts = computed(() => data.value?.items ?? [])

const pickerOpen = ref(false)
const selectedArticles = reactive(new Set<string>())
const recentArticles = ref<Array<{ id: string; title: string; brief: string | null; ai_summary: string | null; relevance_score: number }>>([])
const loadingArticles = ref(false)

function toggleArticle(id: string) {
  if (selectedArticles.has(id)) {
    selectedArticles.delete(id)
  } else {
    selectedArticles.add(id)
  }
}

watch(pickerOpen, async (open) => {
  if (open && recentArticles.value.length === 0) {
    loadingArticles.value = true
    try {
      const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      const res = await $fetch<{ data: Array<Record<string, unknown>> }>('/api/admin/social/articles', {
        query: { since: cutoff }
      })
      recentArticles.value = (Array.isArray(res) ? res : res?.data ?? []).map((a: Record<string, unknown>) => ({
        id: String(a.id || ''),
        title: String(a.title || ''),
        brief: typeof a.brief === 'string' ? a.brief : null,
        ai_summary: typeof a.ai_summary === 'string' ? a.ai_summary : null,
        relevance_score: Number(a.relevance_score ?? 0)
      }))
    } catch {
      // ignore
    } finally {
      loadingArticles.value = false
    }
  }
})

const generating = ref(false)
const approvingId = ref<string | null>(null)
const skippingId = ref<string | null>(null)

const editing = ref<{ id: string; field: EditField } | null>(null)
const editText = ref('')
const savingEdit = ref(false)

const savedPulse = ref<{ id: string; field: EditField } | null>(null)
let savedPulseTimer: ReturnType<typeof setTimeout> | null = null

const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const toast = reactive<{ open: boolean; title: string; message: string; kind: 'success' | 'error' | 'info' }>({
  open: false,
  title: '',
  message: '',
  kind: 'info'
})

const toastClass = computed(() => {
  const base = 'bg-[#161c28]/90 border-[#1e293b]'
  if (toast.kind === 'success') return `${base} ring-1 ring-[#22c55e]/20`
  if (toast.kind === 'error') return `${base} ring-1 ring-red-500/20`
  return `${base} ring-1 ring-[#4cd7f6]/15`
})

function showToast(kind: typeof toast.kind, title: string, message = '') {
  toast.kind = kind
  toast.title = title
  toast.message = message
  toast.open = true
  setTimeout(() => {
    toast.open = false
  }, 3200)
}

function getErrorMessage(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const data = obj.data
    if (data && typeof data === 'object') {
      const statusMessage = (data as Record<string, unknown>).statusMessage
      if (typeof statusMessage === 'string' && statusMessage) return statusMessage
    }
    const message = obj.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unknown error'
}

async function setStatusTab(v: StatusTab) {
  await navigateTo({ path: '/admin/social', query: { status: v } })
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${date} at ${time}`
  } catch {
    return '—'
  }
}

function badgeClass(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/25'
    case 'posted':
      return 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/25'
    case 'skipped':
      return 'bg-[#6b7280]/15 text-[#cbd5e1] border border-[#6b7280]/25'
    default:
      return 'bg-white/5 text-white/80 border border-white/10'
  }
}

function xLen(d: SocialDraft) {
  return (d.text_x || '').length
}

function isEditing(id: string, field: EditField) {
  return editing.value?.id === id && editing.value?.field === field
}

function startEdit(d: SocialDraft, field: EditField) {
  editing.value = { id: d.id, field }
  editText.value = (field === 'text_x' ? d.text_x : d.text_linkedin) || ''
}

async function saveEdit() {
  const e = editing.value
  if (!e || savingEdit.value) return

  // Avoid saving if nothing changed compared to current server value.
  const current = drafts.value.find((d) => d.id === e.id)
  const existing = current ? ((e.field === 'text_x' ? current.text_x : current.text_linkedin) || '') : ''
  if (editText.value.trim() === existing.trim()) {
    editing.value = null
    return
  }

  savingEdit.value = true
  try {
    await $fetch(`/api/admin/social/${e.id}`, {
      method: 'PATCH',
      body: { [e.field]: editText.value }
    })

    editing.value = null
    savedPulse.value = { id: e.id, field: e.field }
    if (savedPulseTimer) clearTimeout(savedPulseTimer)
    savedPulseTimer = setTimeout(() => (savedPulse.value = null), 1200)
    await refresh()
  } catch (err) {
    showToast('error', 'Could not save', getErrorMessage(err))
  } finally {
    savingEdit.value = false
  }
}

async function approveDraft(d: SocialDraft) {
  const ok = confirm('Post this to X?')
  if (!ok) return

  approvingId.value = d.id
  try {
    const res = await $fetch<{ posted_url: string }>(`/api/admin/social/${d.id}/approve`, { method: 'POST' })
    showToast('success', 'Posted to X', res.posted_url)
    await refresh()
  } catch (err) {
    showToast('error', 'Could not post', getErrorMessage(err))
  } finally {
    approvingId.value = null
  }
}

async function skipDraft(d: SocialDraft) {
  skippingId.value = d.id
  try {
    await $fetch(`/api/admin/social/${d.id}/skip`, { method: 'POST' })
    showToast('info', 'Skipped draft')
    await refresh()
  } catch (err) {
    showToast('error', 'Could not skip', getErrorMessage(err))
  } finally {
    skippingId.value = null
  }
}

async function copyLinkedIn(d: SocialDraft) {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText((d.text_linkedin || '').trim())
	    useToast().show('Copied')
    copiedId.value = d.id
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedId.value = null
      copiedTimer = null
    }, 1200)
  } catch (err) {
	    useToast().show('Copy failed', 'error')
    showToast('error', 'Copy failed', getErrorMessage(err))
  }
}

function linkedinParts(text: string): Array<{ text: string; bold: boolean }> {
  const src = String(text || '')
  if (!src) return []

  // Minimal markdown support: **bold**
  // Split on tokens that look like **something** (no nested asterisks).
  const parts = src.split(/(\*\*[^*]+\*\*)/g)
  return parts
    .filter((p) => p !== '')
    .map((p) => {
      const isBold = p.startsWith('**') && p.endsWith('**') && p.length >= 4
      return { text: isBold ? p.slice(2, -2) : p, bold: isBold }
    })
}

async function generateDraft() {
  generating.value = true
  try {
    const body: Record<string, unknown> = {}
    if (selectedArticles.size > 0) {
      body.article_ids = [...selectedArticles]
    }
    const res = await $fetch<Record<string, unknown>>('/api/admin/social/generate', { method: 'POST', body })
    const generated = Boolean((res as Record<string, unknown>).generated)
    if (generated) {
      showToast('success', 'Draft generated')
    } else {
      const reason = typeof (res as Record<string, unknown>).reason === 'string' ? String((res as Record<string, unknown>).reason) : ''
      showToast('info', 'No draft generated', reason || 'See server logs for details.')
    }
    await refresh()
  } catch (err) {
    showToast('error', 'Could not generate', getErrorMessage(err))
  } finally {
    generating.value = false
  }
}
</script>
