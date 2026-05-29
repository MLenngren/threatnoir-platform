<template>
  <div class="-m-6 min-h-full bg-[#0e131f] p-6 text-white">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
	      <div>
	        <h1 class="text-2xl font-semibold tracking-tight">Subscribers</h1>
	        <p class="mt-1 text-sm text-[#94a3b8]">Everyone who signed up for {{ site.name }} notifications.</p>
	      </div>

      <button
        type="button"
        class="rounded-lg border border-[#1e293b] bg-[#161c28] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 hover:bg-[#1a2231] disabled:opacity-50"
        :disabled="pending"
        @click="refresh"
      >
        Refresh
      </button>
    </div>

    <!-- Stats cards -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Total</div>
        <div class="mt-1 text-3xl font-black text-white">{{ stats.total }}</div>
      </div>
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#22c55e]">Verified</div>
        <div class="mt-1 text-3xl font-black text-white">{{ stats.verified }}</div>
      </div>
      <div class="rounded-lg border border-[#1e293b] bg-[#161c28] p-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-[#eab308]">Pending</div>
        <div class="mt-1 text-3xl font-black text-white">{{ stats.pending }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-4 border-b border-[#1e293b]">
        <button
          v-for="t in statusTabs"
          :key="t.value"
          type="button"
          class="relative pb-3 text-sm font-medium transition-colors"
          :class="activeStatus === t.value ? 'text-white' : 'text-[#94a3b8] hover:text-white'"
          @click="activeStatus = t.value"
        >
          {{ t.label }}
          <span
            v-if="activeStatus === t.value"
            class="absolute bottom-0 left-0 right-0 h-[2px] rounded bg-[#4cd7f6]"
          />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <input
          v-model="search"
          type="search"
          placeholder="Search by email..."
          class="w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#4cd7f6]/60 focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/20 sm:w-64"
        >
      </div>
    </div>

    <!-- List -->
    <div class="mt-6 space-y-3">
      <div v-if="pending" class="rounded-lg border border-[#1e293b] bg-[#161c28] p-5 text-sm text-[#94a3b8]">
        Loading subscribers...
      </div>

      <div v-else-if="items.length === 0" class="rounded-lg border border-[#1e293b] bg-[#161c28] p-10 text-center text-sm text-[#94a3b8]">
        No subscribers match the current filter.
      </div>

      <div v-else class="overflow-hidden rounded-lg border border-[#1e293b] bg-[#161c28]">
        <table class="w-full text-sm">
          <thead class="bg-[#0e131f] text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
            <tr>
              <th class="px-4 py-3 text-left">Email</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Channels</th>
              <th class="px-4 py-3 text-left">Signed up</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in items"
              :key="s.id"
              class="border-t border-[#1e293b] hover:bg-[#1a2231]"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-white">{{ s.email }}</div>
                <div v-if="s.name" class="text-xs text-[#94a3b8]">{{ s.name }}</div>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="s.verified"
                  class="inline-flex items-center gap-1.5 rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#22c55e] ring-1 ring-[#22c55e]/25"
                >
                  <UIcon name="i-heroicons-check-circle" class="h-3 w-3" />
                  Verified
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 rounded-full bg-[#eab308]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#eab308] ring-1 ring-[#eab308]/25"
                >
                  <UIcon name="i-heroicons-clock" class="h-3 w-3" />
                  Pending
                </span>
              </td>
              <td class="px-4 py-3">
                <div v-if="s.channels.length === 0" class="text-xs text-[#64748b]">—</div>
                <div v-else class="flex flex-wrap gap-1">
                  <span
                    v-for="(c, i) in s.channels"
                    :key="i"
                    class="inline-flex items-center gap-1 rounded-full bg-[#0e131f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] ring-1 ring-[#1e293b]"
                  >
                    <UIcon :name="channelIcon(c.type)" class="h-3 w-3" />
                    {{ c.type }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-[#94a3b8]">
                {{ fmtDate(s.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!pending && items.length > 0" class="text-xs text-[#64748b]">
        Showing {{ items.length }} of {{ total }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

	const site = useSiteConfig()

type Channel = { type: string; verified: boolean; is_active: boolean }
type Subscriber = {
  id: string
  email: string
  name: string | null
  verified: boolean
  created_at: string
  updated_at: string
  channels: Channel[]
}

type Stats = { total: number; verified: number; pending: number }
type Response = { items: Subscriber[]; total: number; stats: Stats }

const statusTabs = [
  { label: 'All', value: 'all' },
  { label: 'Verified', value: 'verified' },
  { label: 'Pending', value: 'pending' }
]

const activeStatus = ref<'all' | 'verified' | 'pending'>('all')
const search = ref('')
const searchDebounced = ref('')

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchDebounced.value = v
  }, 300)
})

const query = computed(() => ({
  status: activeStatus.value,
  search: searchDebounced.value
}))

const { data, pending, refresh } = await useFetch<Response>('/api/admin/subscribers', {
  query,
  watch: [query]
})

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const stats = computed<Stats>(() => data.value?.stats ?? { total: 0, verified: 0, pending: 0 })

function channelIcon(type: string): string {
  switch (type) {
    case 'email':
      return 'i-heroicons-envelope'
    case 'discord':
      return 'i-heroicons-chat-bubble-left-right'
    case 'telegram':
      return 'i-heroicons-paper-airplane'
    case 'webhook':
      return 'i-heroicons-link'
    case 'api':
      return 'i-heroicons-code-bracket'
    default:
      return 'i-heroicons-bell'
  }
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}
</script>
