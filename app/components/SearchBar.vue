<template>
  <div class="flex items-center gap-3 rounded-xl bg-tn-surface-high/70 px-3 py-2 ring-1 ring-white/10">
    <label class="sr-only" for="search">Search</label>
    <input
      id="search"
      v-model="draft"
      type="search"
      placeholder="Search approved articles…"
      class="w-full bg-transparent px-2 py-2 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant focus:outline-none"
    >
    <button
      v-if="draft"
      type="button"
      class="shrink-0 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
      @click="clear"
    >
      Clear
    </button>

    <UModal v-model:open="authModalOpen">
      <template #content>
        <div class="p-6 text-center">
          <div class="mb-2 font-headline text-lg font-bold text-tn-on-surface">
            Sign in required
          </div>
          <p class="mb-4 text-sm text-tn-on-surface-variant">
            You need to be signed in to search articles.
          </p>
          <UButton :to="loginHref" variant="outline">Sign in</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

const user = useSupabaseUser()

const route = useRoute()
const loginHref = computed(() => `/auth/login?redirect=${encodeURIComponent(route.fullPath)}`)

const authModalOpen = ref(false)
let authModalTimer: ReturnType<typeof setTimeout> | null = null

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const draft = ref(props.modelValue ?? '')

watch(
  () => props.modelValue,
  (v) => {
    if (v !== draft.value) draft.value = v ?? ''
  }
)

const emitDebounced = useDebounceFn(() => {
  const next = draft.value ?? ''
  if (next.trim() && !user.value) {
    showAuthModal()
    return
  }

  emit('update:modelValue', next)
}, 250)

watch(draft, () => emitDebounced())

function clear() {
  draft.value = ''
  emit('update:modelValue', '')
}

function showAuthModal() {
  authModalOpen.value = true

  if (authModalTimer) {
    clearTimeout(authModalTimer)
  }

  authModalTimer = setTimeout(() => {
    authModalOpen.value = false
    authModalTimer = null
  }, 5000)
}
</script>
