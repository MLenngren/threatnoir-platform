<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Users</h1>
        <p class="mt-1 text-sm text-gray-300">View users, block/unblock, inspect API keys and audit log.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="search" placeholder="Search email, name, or id" size="sm" class="w-64" />
        <USelect v-model="blocked" :options="blockedOptions" size="sm" class="w-40" />
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Email</th>
              <th class="px-2 py-2">User id</th>
              <th class="px-2 py-2">Name</th>
              <th class="px-2 py-2">Blocked</th>
              <th class="px-2 py-2">Created</th>
              <th class="px-2 py-2">Last login</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-b border-gray-900">
              <td class="px-2 py-2 text-gray-200">{{ u.email || '—' }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-300">{{ u.id }}</td>
              <td class="px-2 py-2 text-gray-200">{{ u.display_name || '—' }}</td>
              <td class="px-2 py-2" @click.stop>
                <UToggle
                  :model-value="u.is_blocked"
                  :disabled="blockLoadingId === u.id"
                  @update:model-value="(v) => toggleBlocked(u, v)"
                />
              </td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(u.created_at) }}</td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(u.last_sign_in_at) }}</td>
              <td class="px-2 py-2" @click.stop>
                <UButton size="xs" color="gray" variant="soft" @click="openUser(u)">View</UButton>
              </td>
            </tr>

            <tr v-if="!pending && users.length === 0">
              <td colspan="7" class="px-2 py-6 text-center text-sm text-gray-400">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm text-gray-300">
        <div>
          Total: <span class="font-medium text-gray-100">{{ data?.total ?? 0 }}</span>
          <span class="ml-2 text-gray-500">(returned {{ data?.returned ?? 0 }})</span>
        </div>

        <div class="flex items-center gap-2">
          <UButton size="xs" color="gray" variant="soft" :disabled="page <= 1" @click="prev">Prev</UButton>
          <div class="font-mono text-xs">Page {{ page }}</div>
          <UButton size="xs" color="gray" variant="soft" :disabled="!hasNext" @click="next">Next</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type UserRow = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  display_name: string | null
  is_blocked: boolean
}

type UsersResponse = {
  users: UserRow[]
  page: number
  perPage: number
  total: number
  returned: number
}

const search = ref('')
const blocked = ref<'all' | 'blocked' | 'active'>('all')
const page = ref(1)
const perPage = ref(50)

const blockedOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Blocked', value: 'blocked' }
]

const query = computed(() => ({
  search: search.value.trim() || undefined,
  blocked: blocked.value === 'all' ? undefined : blocked.value,
  page: page.value,
  perPage: perPage.value
}))

const { data, pending, refresh } = await useFetch<UsersResponse>('/api/admin/users', { query })
const users = computed(() => data.value?.users ?? [])

const hasNext = computed(() => {
  const total = data.value?.total ?? 0
  const pp = perPage.value
  return page.value * pp < total
})

const blockLoadingId = ref<string | null>(null)

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

watch([search, blocked], async () => {
  page.value = 1
  await refresh()
})

async function toggleBlocked(u: UserRow, v: boolean) {
  blockLoadingId.value = u.id
  try {
    await $fetch(`/api/admin/users/${u.id}/block`, {
      method: 'PATCH',
      body: { is_blocked: v }
    })
    await refresh()
  } finally {
    blockLoadingId.value = null
  }
}

async function openUser(u: UserRow) {
  await navigateTo(`/admin/users/${u.id}`)
}

async function prev() {
  if (page.value <= 1) return
  page.value -= 1
  await refresh()
}

async function next() {
  if (!hasNext.value) return
  page.value += 1
  await refresh()
}
</script>
