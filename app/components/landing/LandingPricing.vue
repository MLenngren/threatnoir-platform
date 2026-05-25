<template>
  <section class="py-16 md:py-20">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-10 text-center md:mb-14">
        <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Pricing</p>
        <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
          Free during beta
        </h2>
        <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          Early users get grandfathered pricing when Pro launches. We will never charge existing users retroactively.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <!-- Free (featured) -->
        <div class="relative rounded-2xl bg-tn-surface-low/70 p-8 ring-2 ring-tn-primary/40 shadow-[0_8px_30px_rgba(76,215,246,0.10)]">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="inline-flex items-center rounded-full bg-tn-primary px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-black">
              Current tier
            </span>
          </div>
          <div>
            <h3 class="font-headline text-xl font-bold text-tn-on-surface">Free</h3>
            <p class="mt-1 text-xs text-tn-on-surface-variant">Everything, during beta</p>
          </div>
          <div class="mt-5 flex items-baseline gap-1">
            <span class="text-4xl font-black text-tn-on-surface">$0</span>
            <span class="text-sm text-tn-on-surface-variant">/forever</span>
          </div>
          <ul class="mt-6 space-y-2 text-sm text-tn-on-surface-variant">
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Daily podcast + weekly roundup</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Focus items + awareness lessons</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Events + resources + tips</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> IOC search + REST API</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> MCP server access</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Email + Discord + Telegram notifications</li>
          </ul>
          <NuxtLink
            to="/auth/signup"
            class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tn-primary px-5 py-3 text-sm font-bold text-black hover:brightness-110"
          >
            Sign up free
          </NuxtLink>
        </div>

        <!-- Pro (coming soon) -->
        <div class="rounded-2xl bg-tn-surface-low/50 p-8 ring-1 ring-white/10 opacity-95">
          <div>
            <h3 class="font-headline text-xl font-bold text-tn-on-surface">Pro</h3>
            <p class="mt-1 text-xs text-tn-on-surface-variant">Coming soon for power users</p>
          </div>
          <div class="mt-5 flex items-baseline gap-1">
            <span class="text-4xl font-black text-tn-on-surface">$9</span>
            <span class="text-sm text-tn-on-surface-variant">/mo (est.)</span>
          </div>
          <ul class="mt-6 space-y-2 text-sm text-tn-on-surface-variant">
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Everything in Free</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-sparkles" class="h-4 w-4 shrink-0 text-tn-primary" /> 10× API rate limits</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-sparkles" class="h-4 w-4 shrink-0 text-tn-primary" /> Complex custom alerts</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-sparkles" class="h-4 w-4 shrink-0 text-tn-primary" /> Early access to weekly roundup</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-sparkles" class="h-4 w-4 shrink-0 text-tn-primary" /> CSV / JSON / STIX export</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-sparkles" class="h-4 w-4 shrink-0 text-tn-primary" /> Slack / Teams integration</li>
          </ul>
          <div v-if="!proSubmitted" class="mt-6">
            <form class="flex flex-col gap-2" @submit.prevent="submitProInterest">
              <input
                v-model="proEmail"
                type="email"
                autocomplete="email"
                required
                placeholder="you@company.com"
                class="rounded-lg bg-tn-surface-high px-3 py-2 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/40"
                :disabled="proSubmitting"
              >
              <button
                type="submit"
                class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-tn-surface-high px-4 py-2 text-sm font-bold text-tn-on-surface hover:bg-tn-surface-highest disabled:opacity-60"
                :disabled="proSubmitting"
              >
                {{ proSubmitting ? 'Saving…' : 'Notify me when Pro launches' }}
              </button>
            </form>
            <p v-if="proError" class="mt-2 text-xs text-red-300">{{ proError }}</p>
          </div>
          <div v-else class="mt-6 rounded-lg bg-tn-primary/10 p-3 text-sm text-tn-on-surface ring-1 ring-tn-primary/30">
            Thanks! You'll be the first to know.
          </div>
        </div>

        <!-- Business -->
        <div class="rounded-2xl bg-tn-surface-low/50 p-8 ring-1 ring-white/10">
          <div>
            <h3 class="font-headline text-xl font-bold text-tn-on-surface">Business</h3>
            <p class="mt-1 text-xs text-tn-on-surface-variant">For security teams and enterprise</p>
          </div>
          <div class="mt-5 flex items-baseline gap-1">
            <span class="text-2xl font-black text-tn-on-surface">Custom</span>
          </div>
          <ul class="mt-6 space-y-2 text-sm text-tn-on-surface-variant">
            <li class="flex gap-2"><UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0 text-tn-primary" /> Everything in Pro</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-lock-closed" class="h-4 w-4 shrink-0 text-tn-primary" /> SSO authentication</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-shield-check" class="h-4 w-4 shrink-0 text-tn-primary" /> SLA + priority support</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-server" class="h-4 w-4 shrink-0 text-tn-primary" /> Private MCP server</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-chart-bar" class="h-4 w-4 shrink-0 text-tn-primary" /> Custom dashboards</li>
            <li class="flex gap-2"><UIcon name="i-heroicons-arrow-path" class="h-4 w-4 shrink-0 text-tn-primary" /> Custom integrations</li>
          </ul>
          <NuxtLink
            to="/contact"
            class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-tn-surface-high px-5 py-3 text-sm font-bold text-tn-on-surface hover:bg-tn-surface-highest"
          >
            Contact us
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const proEmail = ref('')
const proSubmitting = ref(false)
const proSubmitted = ref(false)
const proError = ref('')

async function submitProInterest() {
  const email = proEmail.value.trim()
  if (!email) return
  proSubmitting.value = true
  proError.value = ''
  try {
    await $fetch('/api/pro-interest', {
      method: 'POST',
      body: { email, source: 'landing_pricing' }
    })
    proSubmitted.value = true
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'data' in e
      ? (e.data as Record<string, unknown>)?.statusMessage
      : null
    proError.value = typeof msg === 'string' ? msg : 'Something went wrong'
  } finally {
    proSubmitting.value = false
  }
}
</script>