<template>
	  <nav class="flex flex-wrap items-center gap-2 pb-1 md:justify-start">
    <NuxtLink
      to="/"
	      class="whitespace-nowrap rounded-full px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest ring-1 transition-colors"
	      :class="
	        isAllActive
	          ? 'bg-tn-primary/10 text-tn-primary ring-tn-primary/30'
	          : 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10 hover:bg-tn-surface-lowest'
	      "
    >
      All
    </NuxtLink>

    <NuxtLink
      v-for="cat in visibleCategories"
      :key="cat.id"
      :to="`/category/${cat.slug}`"
	      class="whitespace-nowrap rounded-full px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest ring-1 transition-colors"
	      :class="
	        isActive(cat.slug)
	          ? 'bg-tn-primary/10 text-tn-primary ring-tn-primary/30'
	          : 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10 hover:bg-tn-surface-lowest'
	      "
    >
      {{ cat.name }}
    </NuxtLink>

    <button
      v-if="showToggle"
      type="button"
	      class="whitespace-nowrap rounded-full bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 hover:bg-tn-surface-lowest"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : `+${hiddenCount} more` }}
    </button>
  </nav>
</template>

<script setup>
const route = useRoute()
const { data } = await useFetch('/api/categories')
const categories = computed(() => data.value?.items ?? [])

const expanded = ref(false)
const maxCollapsed = 10

const visibleCategories = computed(() => {
  const all = categories.value
  return expanded.value ? all : all.slice(0, maxCollapsed)
})

const showToggle = computed(() => categories.value.length > maxCollapsed)
const hiddenCount = computed(() => Math.max(0, categories.value.length - maxCollapsed))

const isAllActive = computed(() => route.path === '/' || route.name === 'index')

function isActive(slug) {
  return route.path === `/category/${slug}`
}
</script>
