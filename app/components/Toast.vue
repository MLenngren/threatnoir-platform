<template>
  <div
    class="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0"
    role="status"
    aria-live="polite"
  >
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toast.state.open"
        class="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border bg-tn-surface-high/80 px-4 py-3 text-sm shadow-2xl backdrop-blur ring-1"
        :class="panelClass"
      >
        <div class="min-w-0">
          <div class="font-medium text-tn-on-surface">{{ toast.state.message }}</div>
        </div>

        <button
          type="button"
          class="-mr-1 -mt-1 rounded-lg p-1 text-tn-on-surface-variant/80 transition-colors hover:bg-white/5 hover:text-tn-on-surface"
          aria-label="Dismiss"
          @click="toast.state.open = false"
        >
          ×
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

defineOptions({ name: 'GlobalToast' })

const toast = useToast()

const panelClass = computed(() => {
  const kind = toast.state.kind
  if (kind === 'error') return 'border-red-500/20 ring-red-500/10'
  if (kind === 'info') return 'border-white/10 ring-white/10'
  return 'border-tn-primary/25 ring-tn-primary/10'
})
</script>
