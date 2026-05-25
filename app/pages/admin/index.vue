<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-300">Overview of the curation queue.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Total articles</div>
        <div class="mt-2 text-2xl font-semibold">{{ stats?.totalArticles ?? '—' }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Pending</div>
        <div class="mt-2 text-2xl font-semibold">{{ stats?.pendingArticles ?? '—' }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Approved today</div>
        <div class="mt-2 text-2xl font-semibold">{{ stats?.approvedToday ?? '—' }}</div>
      </UCard>
      <UCard>
        <div class="text-xs uppercase tracking-wider text-gray-400">Sources active</div>
        <div class="mt-2 text-2xl font-semibold">{{ stats?.activeSources ?? '—' }}</div>
      </UCard>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="font-medium">Quick links</div>
          <div class="text-sm text-gray-300">Jump into moderation.</div>
        </div>
        <div class="flex gap-2">
          <UButton to="/admin/articles" color="gray" variant="soft">Articles</UButton>
          <UButton to="/admin/submissions" color="gray" variant="soft">Submissions</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { data: stats } = await useFetch('/api/admin/stats')
</script>
