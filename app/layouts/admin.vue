<template>
  <div class="min-h-dvh bg-black text-gray-100">
    <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[240px_1fr]">
      <aside class="rounded-lg border border-gray-800 bg-gray-950 p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Admin
        </div>

        <nav class="mt-4 space-y-1 text-sm">
          <NuxtLink to="/admin" class="block rounded px-2 py-1 hover:bg-gray-900">Dashboard</NuxtLink>
          <NuxtLink to="/admin/articles" class="block rounded px-2 py-1 hover:bg-gray-900">Articles</NuxtLink>
	          <NuxtLink to="/admin/focus" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
	            <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 text-[#ef4444]" />
	            <span>Focus</span>
	          </NuxtLink>
	          <NuxtLink to="/admin/weekly" class="block rounded px-2 py-1 hover:bg-gray-900">Weekly</NuxtLink>
	          <NuxtLink to="/admin/awareness" class="block rounded px-2 py-1 hover:bg-gray-900">Awareness</NuxtLink>
		          <NuxtLink to="/admin/tips" class="block rounded px-2 py-1 hover:bg-gray-900">Tips</NuxtLink>
			          <NuxtLink to="/admin/resources" class="block rounded px-2 py-1 hover:bg-gray-900">Resources</NuxtLink>
	          <NuxtLink to="/admin/submissions" class="block rounded px-2 py-1 hover:bg-gray-900">Submissions</NuxtLink>
	          <NuxtLink to="/admin/events" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
	            <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 text-gray-400" />
	            <span>Events</span>
	          </NuxtLink>
	          <NuxtLink to="/admin/sources" class="block rounded px-2 py-1 hover:bg-gray-900">Sources</NuxtLink>
		          <NuxtLink to="/admin/x-accounts" class="block rounded px-2 py-1 hover:bg-gray-900">X accounts</NuxtLink>
			          <NuxtLink to="/admin/social" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
			            <UIcon name="i-heroicons-megaphone" class="h-4 w-4 text-gray-400" />
			            <span>Social</span>
			          </NuxtLink>
	          <NuxtLink to="/admin/categories" class="block rounded px-2 py-1 hover:bg-gray-900">Categories</NuxtLink>
		          <NuxtLink to="/admin/users" class="block rounded px-2 py-1 hover:bg-gray-900">Users</NuxtLink>
		          <NuxtLink to="/admin/subscribers" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
		            <UIcon name="i-heroicons-envelope" class="h-4 w-4 text-gray-400" />
		            <span>Subscribers</span>
		          </NuxtLink>
			          <NuxtLink to="/admin/ai-costs" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
			            <UIcon name="i-heroicons-banknotes" class="h-4 w-4 text-gray-400" />
			            <span>AI Costs</span>
			          </NuxtLink>
		          <NuxtLink to="/admin/analytics" class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-900">
		            <UIcon name="i-heroicons-chart-bar" class="h-4 w-4 text-gray-400" />
		            <span>Analytics</span>
		          </NuxtLink>
          <div class="my-3 border-t border-gray-800" />
          <NuxtLink to="/" class="block rounded px-2 py-1 text-gray-300 hover:bg-gray-900 hover:text-white">
            Back to site
          </NuxtLink>
        </nav>
      </aside>

      <div class="space-y-4">
        <header class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
          <div class="text-sm text-gray-300">
            <span v-if="user?.email" class="font-medium text-gray-100">{{ user.email }}</span>
          </div>
          <UButton
            v-if="user"
            color="gray"
            variant="soft"
            size="sm"
            :loading="signingOut"
            @click="onLogout"
          >
            Logout
          </UButton>
        </header>

        <main class="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const signingOut = ref(false)

async function onLogout() {
  signingOut.value = true
  try {
    await supabase.auth.signOut()
  } finally {
    signingOut.value = false
    await navigateTo('/admin/login')
  }
}
</script>

