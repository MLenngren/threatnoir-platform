<script setup lang="ts">
const props = defineProps<{
  data: Record<string, unknown> | Array<Record<string, unknown>>
}>()

const jsonString = computed(() => {
  try {
    return JSON.stringify(props.data)
  } catch {
    return '{}'
  }
})

useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      textContent: jsonString.value,
      tagPosition: 'head'
    }
  ]
}))
</script>

<template>
  <span />
</template>
