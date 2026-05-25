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

    <header class="flex flex-col gap-4 border-b border-[#1e293b] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="text-[10px] font-black tracking-[0.35em] text-[#4cd7f6]/70">ADMIN_EVENTS</div>
        <h1 class="mt-2 text-2xl font-black tracking-tight">Events</h1>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors"
          :class="t.key === statusTab ? 'bg-[#4cd7f6] text-[#0e131f]' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'"
          @click="statusTab = t.key"
        >
          {{ t.label }}
        </button>
      </div>
    </header>

    <section class="mt-6">
      <div v-if="loading" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-[#94a3b8]">
        Loading events…
      </div>

      <div v-else-if="error" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-else-if="items.length === 0" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-10 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#0e131f] ring-1 ring-[#1e293b]">
          <UIcon name="i-heroicons-calendar-days" class="h-6 w-6 text-[#4cd7f6]" />
        </div>
        <div class="text-base font-bold">No events found.</div>
        <div class="mt-1 text-sm text-[#94a3b8]">Try another status filter.</div>
      </div>

      <div v-else class="space-y-3">
        <article v-for="ev in items" :key="ev.id" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-5">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-bold text-white">
                  {{ ev.title }}
                </div>

                <span class="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" :style="categoryBadgeStyle(ev.category)">
                  {{ categoryLabel(ev.category) }}
                </span>

                <span class="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" :style="statusBadgeStyle(ev.status)">
                  {{ ev.status }}
                </span>

                <span class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94a3b8]">
                  {{ sourceLabel(ev) }}
                </span>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94a3b8]">
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
                  {{ formatDateRange(ev.start_date, ev.end_date) }}
                </span>

                <span v-if="ev.is_virtual" class="rounded-full bg-[#4cd7f6]/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#4cd7f6]">
                  VIRTUAL
                </span>
                <span v-else-if="ev.location" class="inline-flex items-center gap-1">
                  <UIcon name="i-heroicons-map-pin" class="h-4 w-4" />
                  {{ ev.location }}
                </span>

                <span v-if="ev.organizer">{{ ev.organizer }}</span>
              </div>

              <p v-if="ev.description" class="mt-3 text-sm leading-6 text-[#cbd5e1]">
                {{ ev.description }}
              </p>

              <a
                v-if="ev.url"
                :href="ev.url"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#4cd7f6] hover:underline"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                Open event website
              </a>
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-2" @click.stop>
              <button
                v-if="ev.status === 'pending'"
                type="button"
                class="rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="busyId === ev.id"
                @click="approve(ev)"
              >
                Approve
              </button>

              <button
                v-if="ev.status === 'pending'"
                type="button"
                class="rounded-lg border border-red-500/40 bg-transparent px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-70"
                :disabled="busyId === ev.id"
                @click="reject(ev)"
              >
                Reject
              </button>

              <button
                type="button"
                class="rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-xs font-bold text-[#94a3b8] hover:text-white"
                @click="toggleEdit(ev)"
              >
                {{ editingId === ev.id ? 'Close' : 'Edit' }}
              </button>
            </div>
          </div>

          <!-- Inline editor -->
          <div v-if="editingId === ev.id" class="mt-5 rounded-xl border border-[#1e293b] bg-[#0e131f] p-4" @click.stop>
            <div v-if="editError" class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {{ editError }}
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Title</label>
                <input
                  v-model.trim="editForm.title"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">URL</label>
                <input
                  v-model.trim="editForm.url"
                  type="url"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                  placeholder="https://..."
                >
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Start Date</label>
                <input
                  v-model.trim="editForm.start_date"
                  type="date"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>
              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">End Date</label>
                <input
                  v-model.trim="editForm.end_date"
                  type="date"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Location</label>
                <input
                  v-model.trim="editForm.location"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="inline-flex items-center gap-2 text-sm text-[#94a3b8]">
                  <input
                    v-model="editForm.is_virtual"
                    type="checkbox"
                    class="h-4 w-4 rounded border-[#1e293b] bg-[#0e131f] text-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/40"
                  >
                  Virtual
                </label>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Organizer</label>
                <input
                  v-model.trim="editForm.organizer"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Category</label>
                <select
                  v-model="editForm.category"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
                  <option value="conference">Conference</option>
                  <option value="workshop">Workshop</option>
                  <option value="webinar">Webinar</option>
                  <option value="ctf">CTF</option>
                  <option value="meetup">Meetup</option>
                </select>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Description</label>
                <textarea
                  v-model.trim="editForm.description"
                  rows="4"
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                />
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2 border-t border-[#1e293b] pt-4">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-bold text-[#94a3b8] hover:text-white"
                :disabled="saving"
                @click="cancelEdit()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-sm font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="saving"
                @click="saveEdit(ev)"
              >
                <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type EventCategory = 'conference' | 'workshop' | 'webinar' | 'ctf' | 'meetup'
type EventStatus = 'pending' | 'approved' | 'rejected'

type AdminEvent = {
  id: string
  title: string
  slug: string
  description: string | null
  url: string | null
  start_date: string
  end_date: string | null
  location: string | null
  is_virtual: boolean
  organizer: string | null
  category: EventCategory | null
  tags: unknown
  source_name: string | null
  status: EventStatus
  is_community_submitted: boolean
  created_at: string
  updated_at: string
}

const tabs: Array<{ key: 'pending' | 'approved' | 'rejected' | 'all'; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' }
]

const statusTab = ref<'pending' | 'approved' | 'rejected' | 'all'>('pending')
const items = ref<AdminEvent[]>([])
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

const apiQuery = computed(() => {
  return statusTab.value === 'all' ? {} : { status: statusTab.value }
})

const { data, pending, error: fetchError, refresh } = useFetch<{ items: AdminEvent[] }>('/api/admin/events', {
  query: apiQuery
})

const loading = computed(() => pending.value)

watch(
  data,
  (res) => {
    if (!res) return
    items.value = Array.isArray(res.items) ? res.items : []
  },
  { immediate: true }
)

watch(
  fetchError,
  (e) => {
    error.value = e ? getErrorMessage(e) : null
  },
  { immediate: true }
)

function formatDateRange(start: string, end?: string | null): string {
  const s = new Date(start + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  if (!end || end === start) return s.toLocaleDateString('en-US', opts)
  const e = new Date(end + 'T00:00:00')
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${e.getDate()}, ${e.getFullYear()}`
  }
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`
}

function categoryLabel(cat: AdminEvent['category']): string {
  if (cat === 'conference') return 'Conference'
  if (cat === 'workshop') return 'Workshop'
  if (cat === 'webinar') return 'Webinar'
  if (cat === 'ctf') return 'CTF'
  if (cat === 'meetup') return 'Meetup'
  return 'Event'
}

function categoryColor(cat: AdminEvent['category']): string {
  if (cat === 'conference') return '#4cd7f6'
  if (cat === 'workshop') return '#8b5cf6'
  if (cat === 'webinar') return '#22c55e'
  if (cat === 'ctf') return '#ef4444'
  if (cat === 'meetup') return '#f97316'
  return '#94a3b8'
}

function categoryBadgeStyle(cat: AdminEvent['category']) {
  const c = categoryColor(cat)
  return { backgroundColor: `${c}22`, border: `1px solid ${c}55`, color: c }
}

function statusBadgeStyle(status: AdminEvent['status']) {
  const c = status === 'pending' ? '#eab308' : status === 'approved' ? '#22c55e' : '#ef4444'
  return { backgroundColor: `${c}22`, border: `1px solid ${c}55`, color: c }
}

function sourceLabel(ev: AdminEvent): string {
  if (ev.is_community_submitted) return 'User submitted'
  if (ev.source_name) return `Ingested from ${ev.source_name}`
  return 'Ingested'
}

async function approve(ev: AdminEvent) {
  await patchStatus(ev, 'approved')
}

async function reject(ev: AdminEvent) {
  await patchStatus(ev, 'rejected')
}

async function patchStatus(ev: AdminEvent, status: EventStatus) {
  busyId.value = ev.id
  try {
    await $fetch(`/api/admin/events/${encodeURIComponent(ev.id)}`, { method: 'PATCH', body: { status } })
    showToast('success', 'Updated', `Event marked as ${status}.`)
    await refresh()
  } catch (e: unknown) {
    showToast('error', 'Could not update', getErrorMessage(e))
  } finally {
    busyId.value = null
  }
}

// Inline edit
const editingId = ref<string | null>(null)
const saving = ref(false)
const editError = ref<string | null>(null)

const editForm = reactive<{
  title: string
  description: string
  url: string
  start_date: string
  end_date: string
  location: string
  is_virtual: boolean
  organizer: string
  category: EventCategory
}>(
  {
    title: '',
    description: '',
    url: '',
    start_date: '',
    end_date: '',
    location: '',
    is_virtual: false,
    organizer: '',
    category: 'conference'
  }
)

function toggleEdit(ev: AdminEvent) {
  if (editingId.value === ev.id) {
    cancelEdit()
    return
  }
  editingId.value = ev.id
  editError.value = null
  editForm.title = ev.title
  editForm.description = ev.description ?? ''
  editForm.url = ev.url ?? ''
  editForm.start_date = ev.start_date
  editForm.end_date = ev.end_date ?? ''
  editForm.location = ev.location ?? ''
  editForm.is_virtual = Boolean(ev.is_virtual)
  editForm.organizer = ev.organizer ?? ''
  editForm.category = (ev.category as EventCategory) || 'conference'
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

async function saveEdit(ev: AdminEvent) {
  if (saving.value) return
  editError.value = null
  saving.value = true
  try {
    if (!editForm.title.trim()) throw new Error('Title is required')
    if (!editForm.start_date.trim()) throw new Error('Start date is required')
    if (editForm.url.trim() && !/^https?:\/\//i.test(editForm.url.trim())) throw new Error('URL must start with http(s)://')
    if (editForm.end_date.trim() && editForm.end_date.trim() < editForm.start_date.trim()) throw new Error('End date must be on/after start date')

    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      url: editForm.url.trim() || null,
      start_date: editForm.start_date.trim(),
      end_date: editForm.end_date.trim() || null,
      location: editForm.location.trim() || null,
      is_virtual: editForm.is_virtual,
      organizer: editForm.organizer.trim() || null,
      category: editForm.category
    }

    await $fetch(`/api/admin/events/${encodeURIComponent(ev.id)}`, { method: 'PATCH', body: payload })
    showToast('success', 'Saved', 'Event updated.')
    editingId.value = null
    await refresh()
  } catch (e: unknown) {
    editError.value = getErrorMessage(e)
  } finally {
    saving.value = false
  }
}

// Toast
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

function getErrorMessage(e: unknown): string {
  const anyE = e as Record<string, unknown>
  const msg = (anyE?.data as Record<string, unknown> | undefined)?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  if (typeof anyE?.statusMessage === 'string' && anyE.statusMessage.trim()) return anyE.statusMessage
  if (typeof anyE?.message === 'string' && anyE.message.trim()) return anyE.message
  return 'Something went wrong.'
}
</script>
