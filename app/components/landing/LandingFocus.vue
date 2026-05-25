<template>
  <section v-if="focusItems.length > 0" class="py-10 md:py-14">
    <div class="mx-auto max-w-6xl px-6">
      <div class="rounded-2xl border border-[#ef4444]/20 bg-[#161c28] p-5 md:p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <p class="font-label text-[10px] font-bold uppercase tracking-widest text-[#ef4444]">FOCUS RIGHT NOW</p>
            <ul class="mt-3 space-y-2">
              <li
                v-for="item in focusItems"
                :key="item.id"
                class="flex items-start gap-2"
              >
                <span class="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest" :class="severityBadgeClass(item.severity)">
                  {{ item.severity.toUpperCase() }}
                </span>
                <span class="text-sm font-semibold text-white">{{ item.title }}</span>
              </li>
            </ul>
          </div>
          <NuxtLink
            to="/focus"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#fca5a5] hover:bg-[#ef4444]/20"
          >
            View advisories →
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type FocusSeverity = 'critical' | 'high' | 'medium'

type FocusItem = {
  id: string
  title: string
  severity: FocusSeverity
}

const { data } = await useFetch<{ items: FocusItem[] }>('/api/focus')
const focusItems = computed(() => data.value?.items ?? [])

function severityBadgeClass(s: FocusSeverity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (s === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/25'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
}
</script>
