<template>
  <main class="-mt-6 -mx-6 min-h-[calc(100dvh-5rem)] bg-[#0e131f] p-6 text-white">
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

    <div class="mx-auto max-w-5xl">
      <!-- Hero -->
      <header class="flex flex-col gap-4 border-b border-[#1e293b] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-3xl font-black tracking-tight md:text-4xl">Security Events &amp; Conferences</h1>
          <p class="mt-2 max-w-2xl text-sm text-[#94a3b8] md:text-base">
            Upcoming conferences, workshops, and CTFs for security professionals
          </p>
        </div>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-sm font-bold text-[#0e131f] shadow-[0_8px_24px_rgba(76,215,246,0.15)] hover:brightness-110"
          @click="openSubmit()"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          Submit Event
        </button>
      </header>

      <!-- Filters -->
      <section class="mt-6 space-y-3">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in categoryOptions"
              :key="c.key"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors"
              :class="
                c.key === category
                  ? 'bg-[#4cd7f6] text-[#0e131f]'
                  : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
              "
              @click="setCategory(c.key)"
            >
              {{ c.label }}
            </button>
          </div>

          <label class="flex items-center gap-2 text-sm text-[#94a3b8]">
            <input
              v-model="includePast"
              type="checkbox"
              class="h-4 w-4 rounded border-[#1e293b] bg-[#0e131f] text-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/40"
            >
            Include past events
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Audience:</span>
          <button
            v-for="a in audienceOptions"
            :key="a.key"
            type="button"
            class="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors"
            :class="
              a.key === audience
                ? 'bg-[#8b5cf6] text-white'
                : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'
            "
            @click="setAudience(a.key)"
          >
            {{ a.label }}
          </button>
        </div>
      </section>

      <!-- List -->
      <section class="mt-6">
        <div v-if="loading && items.length === 0" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-[#94a3b8]">
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
          <div class="mt-1 text-sm text-[#94a3b8]">Try a different category or include past events.</div>
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="ev in items"
            :key="ev.id"
            class="cursor-pointer rounded-xl border border-[#1e293b] bg-[#161c28] p-5 transition-colors hover:border-[#4cd7f6]/30"
            @click="toggleExpanded(ev.id)"
          >
            <!-- Collapsed row -->
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <a
                  v-if="ev.url"
                  :href="ev.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="truncate text-lg font-bold text-white hover:text-[#4cd7f6] hover:underline"
                  @click.stop
                >{{ ev.title }}</a>
                <a
                  v-else
                  :href="`https://www.google.com/search?q=${encodeURIComponent(ev.title + ' ' + (ev.organizer || '') + ' conference')}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="truncate text-lg font-bold text-white hover:text-[#4cd7f6] hover:underline"
                  @click.stop
                >{{ ev.title }}</a>
                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94a3b8]">
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
                    {{ formatDateRange(ev.start_date, ev.end_date) }}
                  </span>

                  <span v-if="ev.is_virtual" class="inline-flex items-center gap-2">
                    <span class="rounded-full bg-[#4cd7f6]/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#4cd7f6]">
                      VIRTUAL
                    </span>
                  </span>
                  <span v-else-if="ev.location" class="inline-flex items-center gap-1">
                    <UIcon name="i-heroicons-map-pin" class="h-4 w-4" />
                    {{ ev.location }}
                  </span>

                  <span v-if="ev.organizer" class="truncate">
                    {{ ev.organizer }}
                  </span>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-3">
                <span v-if="ev.audience && ev.audience !== 'general'" class="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#c4b5fd]">
                  {{ audienceLabel(ev.audience) }}
                </span>
                <span class="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest" :style="categoryBadgeStyle(ev.category)">
                  {{ categoryLabel(ev.category) }}
                </span>

                <UIcon
                  name="i-heroicons-chevron-down"
                  class="h-5 w-5 text-[#94a3b8] transition-transform"
                  :class="expanded[ev.id] ? 'rotate-180' : ''"
                />
              </div>
            </div>

            <!-- Expanded -->
            <div v-if="expanded[ev.id]" class="mt-4 space-y-4" @click.stop>
              <p v-if="ev.description" class="text-sm leading-6 text-[#cbd5e1]">
                {{ ev.description }}
              </p>

	              <div v-if="normalizedTags(ev.tags).length" class="flex flex-wrap gap-2">
	                <template v-for="t in normalizedTags(ev.tags)" :key="t">
	                  <NuxtLink
	                    v-if="isTagSlug(t)"
	                    :to="tagHref(t)"
	                    class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94a3b8]"
	                  >
	                    {{ t }}
	                  </NuxtLink>
	                  <span
	                    v-else
	                    class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94a3b8]"
	                  >
	                    {{ t }}
	                  </span>
	                </template>
	              </div>

              <div class="flex flex-wrap items-center gap-3">
                <a
                  :href="ev.url || `https://www.google.com/search?q=${encodeURIComponent(ev.title + ' ' + (ev.organizer || '') + ' conference')}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center gap-2 rounded-lg border border-[#4cd7f6]/60 px-3 py-2 text-xs font-bold tracking-wide text-[#4cd7f6] hover:bg-[#4cd7f6]/10"
                >
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                  {{ ev.url ? 'Visit Website' : 'Search Event' }}
                </a>

                <span v-if="ev.source_name" class="text-xs text-[#94a3b8]">
                  via {{ ev.source_name }}
                </span>
              </div>
            </div>
          </article>

          <div v-if="canLoadMore" class="pt-2">
            <button
              type="button"
              class="w-full rounded-xl border border-[#1e293b] bg-[#161c28] px-4 py-3 text-sm font-bold text-[#94a3b8] hover:text-white disabled:opacity-60"
              :disabled="loadingMore"
              @click="loadMore"
            >
              <span v-if="loadingMore" class="inline-flex items-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-[#94a3b8]/40 border-t-[#4cd7f6]" />
                Loading…
              </span>
              <span v-else>Load More</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Submit modal -->
    <Teleport to="body">
      <div
        v-if="submitOpen"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="closeSubmit()"
      >
        <div class="w-full max-w-xl overflow-hidden rounded-xl border border-[#1e293b] bg-[#161c28] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div class="flex items-start justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
            <div>
              <div class="text-lg font-extrabold">Submit an Event</div>
              <div class="mt-1 text-sm text-[#94a3b8]">We’ll review it before publishing.</div>
            </div>
            <button type="button" class="text-[#94a3b8] hover:text-white" aria-label="Close" @click="closeSubmit()">
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>

          <form class="space-y-4 px-6 py-5" @submit.prevent="submitEvent">
            <div v-if="submitError" class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {{ submitError }}
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Title <span class="text-[#4cd7f6]">*</span></label>
                <input
                  v-model.trim="form.title"
                  type="text"
                  required
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                  placeholder="e.g., Black Hat Europe"
                >
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Event URL</label>
                <input
                  v-model.trim="form.url"
                  type="url"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                  placeholder="https://…"
                >
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Start Date <span class="text-[#4cd7f6]">*</span></label>
                <input
                  v-model.trim="form.start_date"
                  type="date"
                  required
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">End Date</label>
                <input
                  v-model.trim="form.end_date"
                  type="date"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Location</label>
                <input
                  v-model.trim="form.location"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                  placeholder="City, Country or Virtual"
                >
              </div>

              <div class="sm:col-span-2">
                <label class="inline-flex items-center gap-2 text-sm text-[#94a3b8]">
                  <input
                    v-model="form.is_virtual"
                    type="checkbox"
                    class="h-4 w-4 rounded border-[#1e293b] bg-[#0e131f] text-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/40"
                  >
                  Virtual
                </label>
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Organizer</label>
                <input
                  v-model.trim="form.organizer"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Category</label>
                <select
                  v-model="form.category"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                >
                  <option value="conference">Conference</option>
                  <option value="workshop">Workshop</option>
                  <option value="webinar">Webinar</option>
                  <option value="ctf">CTF</option>
                  <option value="meetup">Meetup</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Description</label>
                <textarea
                  v-model.trim="form.description"
                  rows="3"
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Your Email</label>
                <input
                  v-model.trim="form.submitted_by_email"
                  type="email"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6] focus:ring-2 focus:ring-[#4cd7f6]/25"
                  placeholder="For follow-up (optional)"
                >
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-[#1e293b] pt-4">
              <button type="button" class="rounded-lg px-3 py-2 text-sm font-bold text-[#94a3b8] hover:text-white" :disabled="submitting" @click="closeSubmit()">
                Cancel
              </button>
              <button
                type="submit"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4cd7f6] px-4 py-2 text-sm font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="submitting"
              >
                <span v-if="submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                {{ submitting ? 'Submitting…' : 'Submit Event' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
type EventCategory = 'conference' | 'workshop' | 'webinar' | 'ctf' | 'meetup'

type EventItem = {
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
}

type EventsResponse = { items: EventItem[]; total: number }

useSeoMeta({
  title: 'Upcoming Security Events & Conferences | ThreatNoir',
  description: 'Cybersecurity conferences, workshops, CTFs, and meetups. Filtered by category, audience, and date. Submit your own event.',
  ogTitle: 'Upcoming Security Events & Conferences | ThreatNoir',
  ogDescription: 'Cybersecurity conferences, workshops, CTFs, and meetups. Filtered by category, audience, and date. Submit your own event.',
  ogImage: 'https://threatnoir.com/images/category-default.png',
  ogUrl: 'https://threatnoir.com/events',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Upcoming Security Events & Conferences | ThreatNoir',
  twitterDescription: 'Cybersecurity conferences, workshops, CTFs, and meetups. Filtered by category, audience, and date. Submit your own event.',
  twitterImage: 'https://threatnoir.com/images/category-default.png',
  author: 'Marcus Lenngren'
})

const categoryOptions: Array<{ key: '' | EventCategory; label: string }> = [
  { key: '', label: 'All' },
  { key: 'conference', label: 'Conferences' },
  { key: 'workshop', label: 'Workshops' },
  { key: 'webinar', label: 'Webinars' },
  { key: 'ctf', label: 'CTFs' },
  { key: 'meetup', label: 'Meetups' }
]

const audienceOptions = [
  { key: '', label: 'All' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'soc', label: 'SOC / Blue Team' },
  { key: 'offensive', label: 'Offensive / Red Team' },
  { key: 'iam', label: 'IAM' },
  { key: 'grc', label: 'GRC' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'appsec', label: 'AppSec' },
  { key: 'ot-iot', label: 'OT / IoT' },
  { key: 'threat-intel', label: 'Threat Intel' },
  { key: 'ai-security', label: 'AI Security' },
  { key: 'general', label: 'General' }
]

const category = ref<'' | EventCategory>('')
const audience = ref('')
const includePast = ref(false)

const items = ref<EventItem[]>([])
const total = ref(0)
const limit = 50
const offset = ref(0)

const loadingMore = ref(false)
const error = ref<string | null>(null)

const expanded = reactive<Record<string, boolean>>({})

function setCategory(v: '' | EventCategory) {
  category.value = v
}

function setAudience(v: string) {
  audience.value = v
}

function toggleExpanded(id: string) {
  expanded[id] = !expanded[id]
}

const canLoadMore = computed(() => items.value.length < total.value)

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

function normalizedTags(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
}

const TAG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isTagSlug(v: string) {
  const s = (v || '').trim().toLowerCase()
  return TAG_SLUG_REGEX.test(s) && s.length <= 60
}

function tagHref(v: string) {
  const s = (v || '').trim().toLowerCase()
  return `/tag/${encodeURIComponent(s)}`
}

function categoryLabel(cat: EventItem['category']): string {
  if (cat === 'conference') return 'Conference'
  if (cat === 'workshop') return 'Workshop'
  if (cat === 'webinar') return 'Webinar'
  if (cat === 'ctf') return 'CTF'
  if (cat === 'meetup') return 'Meetup'
  return 'Event'
}

function categoryColor(cat: EventItem['category']): string {
  if (cat === 'conference') return '#4cd7f6'
  if (cat === 'workshop') return '#8b5cf6'
  if (cat === 'webinar') return '#22c55e'
  if (cat === 'ctf') return '#ef4444'
  if (cat === 'meetup') return '#f97316'
  return '#94a3b8'
}

function audienceLabel(a: string): string {
  const map: Record<string, string> = {
    leadership: 'Leadership', soc: 'SOC', offensive: 'Offensive', iam: 'IAM',
    grc: 'GRC', cloud: 'Cloud', appsec: 'AppSec', 'ot-iot': 'OT/IoT',
    'threat-intel': 'Threat Intel', 'ai-security': 'AI Security',
    general: 'General', privacy: 'Privacy'
  }
  return map[a] || a
}

function categoryBadgeStyle(cat: EventItem['category']) {
  const c = categoryColor(cat)
  return {
    backgroundColor: `${c}22`,
    border: `1px solid ${c}55`,
    color: c
  }
}

const baseQuery = computed(() => {
  const q: Record<string, string | number | undefined> = {
    limit,
    offset: 0,
    include_past: includePast.value ? 'true' : 'false'
  }
  if (category.value) q.category = category.value
  if (audience.value) q.audience = audience.value
  return q
})

const { data, pending, error: fetchError } = useFetch<EventsResponse>('/api/events', {
  query: baseQuery
})

const loading = computed(() => pending.value)

watch(
  data,
  (res) => {
    if (!res) return
    items.value = Array.isArray(res.items) ? res.items : []
    total.value = typeof res.total === 'number' ? res.total : items.value.length
    offset.value = items.value.length
    for (const k of Object.keys(expanded)) expanded[k] = false
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

async function loadMore() {
  if (loading.value || loadingMore.value || !canLoadMore.value) return
  loadingMore.value = true
  try {
    const res = await $fetch<EventsResponse>('/api/events', {
      query: {
        ...baseQuery.value,
        offset: offset.value
      }
    })

    const nextItems = Array.isArray(res.items) ? res.items : []
    items.value = [...items.value, ...nextItems]
    total.value = typeof res.total === 'number' ? res.total : total.value
    offset.value = items.value.length
  } catch (e: unknown) {
    showToast('error', 'Could not load more', getErrorMessage(e))
  } finally {
    loadingMore.value = false
  }
}

// Submit modal
const submitOpen = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

const form = reactive<{
  title: string
  url: string
  start_date: string
  end_date: string
  location: string
  is_virtual: boolean
  organizer: string
  category: EventCategory
  description: string
  submitted_by_email: string
}>(
  {
    title: '',
    url: '',
    start_date: '',
    end_date: '',
    location: '',
    is_virtual: false,
    organizer: '',
    category: 'conference',
    description: '',
    submitted_by_email: ''
  }
)

function resetForm() {
  form.title = ''
  form.url = ''
  form.start_date = ''
  form.end_date = ''
  form.location = ''
  form.is_virtual = false
  form.organizer = ''
  form.category = 'conference'
  form.description = ''
  form.submitted_by_email = ''
  submitError.value = null
}

function openSubmit() {
  submitOpen.value = true
  submitError.value = null
}

function closeSubmit() {
  submitOpen.value = false
  submitError.value = null
}

function validateSubmit(): string | null {
  if (!form.title.trim()) return 'Title is required.'
  if (!form.start_date.trim()) return 'Start date is required.'
  if (form.url.trim() && !/^https?:\/\//i.test(form.url.trim())) return 'Event URL must start with http(s)://'
  if (form.end_date.trim() && form.end_date.trim() < form.start_date.trim()) return 'End date must be on/after start date.'
  return null
}

async function submitEvent() {
  const validation = validateSubmit()
  if (validation) {
    submitError.value = validation
    return
  }

  submitting.value = true
  submitError.value = null
  try {
    const payload = {
      title: form.title.trim(),
      url: form.url.trim() || undefined,
      start_date: form.start_date.trim(),
      end_date: form.end_date.trim() || null,
      location: form.location.trim() || null,
      is_virtual: form.is_virtual,
      organizer: form.organizer.trim() || null,
      category: form.category,
      description: form.description.trim() || null,
      submitted_by_email: form.submitted_by_email.trim() || null
    }
    const res = await $fetch<{ submitted?: boolean; message?: string }>('/api/events/submit', { method: 'POST', body: payload })
    closeSubmit()
    resetForm()
    showToast('success', 'Thanks!', res.message || 'Your event will be reviewed and added shortly.')
  } catch (e: unknown) {
    submitError.value = getErrorMessage(e)
  } finally {
    submitting.value = false
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
