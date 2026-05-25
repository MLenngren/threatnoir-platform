<template>
  <UModal
    v-model:open="openModel"
    :title="article?.title ?? 'Rate article'"
    :description="'Choose a score from 1 to 10'"
  >
    <template #content>
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="n in 10"
            :key="n"
            size="sm"
            :color="selected === n ? 'primary' : 'gray'"
            :variant="selected === n ? 'solid' : 'soft'"
            :disabled="loadingMine || submitting"
            @click="selected = n"
          >
            {{ n }}
          </UButton>
        </div>

        <div class="flex items-center justify-between text-xs text-gray-400">
          <span>1 = Ok</span>
          <span>10 = Really valuable</span>
        </div>

        <div class="flex items-center justify-end gap-2">
          <UButton color="gray" variant="soft" :disabled="submitting" @click="openModel = false">
            Cancel
          </UButton>
          <UButton :loading="submitting" :disabled="loadingMine" @click="submit">
            Submit
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
type ArticleLike = {
  id: string
  title: string
}

const props = defineProps<{ open: boolean; article: ArticleLike; visitorHash: string }>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'rated', payload: { score: number; avg_score: number | string | null; score_count: number }): void
}>()

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const selected = ref<number>(5)
const loadingMine = ref(false)
const submitting = ref(false)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    if (!props.visitorHash) return

    loadingMine.value = true
    try {
      const res = await $fetch<{ score: number | null }>(`/api/articles/${props.article.id}/my-rating`, {
        query: { visitor_hash: props.visitorHash }
      })
      selected.value = res?.score ?? 5
    } catch {
      selected.value = 5
    } finally {
      loadingMine.value = false
    }
  }
)

async function submit() {
  if (submitting.value) return

  submitting.value = true
  try {
    const res = await $fetch<{ avg_score: number | string | null; score_count: number }>(
      `/api/articles/${props.article.id}/rate`,
      {
        method: 'POST',
        body: { visitor_hash: props.visitorHash, score: selected.value }
      }
    )

    emit('rated', {
      score: selected.value,
      avg_score: res.avg_score,
      score_count: res.score_count
    })
    openModel.value = false
  } finally {
    submitting.value = false
  }
}
</script>
