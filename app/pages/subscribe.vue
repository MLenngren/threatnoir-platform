<template>
  <AuthGate v-if="!authenticated" />
	<main v-else class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
	    <section class="glass-panel rounded-3xl p-6 md:p-10">
	      <div class="flex items-center gap-3">
	        <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	        <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Subscription</span>
	      </div>
	      <h1 class="mt-3 font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-4xl">Subscribe to notifications</h1>
	      <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          Tell us what you care about, and how you want to be notified.
        </p>
      </section>

      <form class="mt-6 space-y-6" @submit.prevent="submit">
        <!-- Alerts -->
        <div
          v-if="successMessage"
          class="rounded-2xl border border-green-900/40 bg-green-950/30 px-5 py-4 text-sm text-green-200"
        >
          {{ successMessage }}
        </div>
        <div
          v-else-if="errorMessage"
          class="rounded-2xl border border-red-900/40 bg-red-950/25 px-5 py-4 text-sm text-red-200"
        >
          {{ errorMessage }}
        </div>

        <!-- Section 1: Email -->
	      <section class="glass-panel rounded-2xl p-6 md:p-7">
	        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Email</h2>
          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
	            <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="subscribe-email">Email address</label>
              <input
                id="subscribe-email"
                v-model.trim="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                placeholder="you@company.com"
	              class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
              >
	            <p v-if="email && !emailValid" class="mt-2 text-xs text-red-200">Please enter a valid email address.</p>
            </div>
          </div>
        </section>

        <!-- Section 2: Preferences -->
	      <section class="glass-panel rounded-2xl p-6 md:p-7">
          <div class="flex flex-col gap-1">
	          <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">What do you want to hear about?</h2>
	          <p class="text-sm text-tn-on-surface-variant">You can be broad now and refine later.</p>
          </div>

		  <!-- All updates toggle -->
		  <div class="mt-5 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
		    <label class="flex items-start justify-between gap-4">
		      <span class="min-w-0">
		        <span class="block text-sm font-semibold text-tn-on-surface">Send me all security updates</span>
		        <span class="mt-1 block text-xs leading-5 text-tn-on-surface-variant">
		          Uncheck to choose topics, regulations, regions, and custom monitoring.
		        </span>
		      </span>
		      <span class="shrink-0">
		        <input
		          v-model="allUpdates"
		          type="checkbox"
		          class="h-6 w-6 rounded border-white/20 bg-black/40 text-tn-primary focus:ring-tn-primary/30"
		        >
		      </span>
		    </label>
		  </div>

		  <!-- Advanced preferences (tabs) -->
		  <div v-if="!allUpdates" class="mt-5">
		    <div class="flex gap-2 overflow-x-auto rounded-xl border border-gray-800 bg-black/20 p-2">
		      <button
		        type="button"
		        class="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition"
		        :class="activeTab === 'topics' ? 'bg-gray-950/70 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]'"
		        @click="activeTab = 'topics'"
		      >
		        Topics
		        <span
		          v-if="tabCounts.topics > 0"
		          class="rounded-full border border-gray-800 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-gray-200"
		        >
		          {{ tabCounts.topics }}
		        </span>
		      </button>
		      <button
		        type="button"
		        class="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition"
		        :class="activeTab === 'regulations' ? 'bg-gray-950/70 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]'"
		        @click="activeTab = 'regulations'"
		      >
		        Regulations
		        <span
		          v-if="tabCounts.regulations > 0"
		          class="rounded-full border border-gray-800 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-gray-200"
		        >
		          {{ tabCounts.regulations }}
		        </span>
		      </button>
		      <button
		        type="button"
		        class="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition"
		        :class="activeTab === 'regions' ? 'bg-gray-950/70 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]'"
		        @click="activeTab = 'regions'"
		      >
		        Regions
		        <span
		          v-if="tabCounts.regions > 0"
		          class="rounded-full border border-gray-800 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-gray-200"
		        >
		          {{ tabCounts.regions }}
		        </span>
		      </button>
		      <button
		        type="button"
		        class="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition"
		        :class="activeTab === 'custom' ? 'bg-gray-950/70 text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]'"
		        @click="activeTab = 'custom'"
		      >
		        Custom
		        <span
		          v-if="tabCounts.custom > 0"
		          class="rounded-full border border-gray-800 bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-gray-200"
		        >
		          {{ tabCounts.custom }}
		        </span>
		      </button>
		    </div>

		    <div class="mt-4 rounded-xl border border-gray-800 bg-black/20 p-4">
		      <!-- Tab: Topics -->
		      <div v-show="activeTab === 'topics'" class="space-y-5">
		        <div class="flex items-center justify-between gap-3">
		          <div>
		            <div class="text-sm font-semibold text-gray-200">Topics</div>
		            <div class="mt-0.5 text-xs text-gray-400">Pick the areas you want monitored.</div>
		          </div>
		          <div class="text-xs text-gray-500">
		            <span class="font-mono text-gray-300">{{ selectedCategories.length }}</span> selected
		          </div>
		        </div>

		        <div v-if="categoriesPending" class="text-sm text-gray-400">Loading categories…</div>
		        <div v-else-if="categoriesError" class="text-sm text-gray-400">Could not load categories.</div>
		        <div v-else class="space-y-5">
		          <div
		            v-for="group in categoryGroups"
		            :key="group.key"
		            class="space-y-2"
		          >
		            <div class="text-xs font-semibold uppercase tracking-wider text-gray-400">
		              {{ group.title }}
		            </div>
		            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
		              <label
		                v-for="c in group.items"
		                :key="c.slug"
		                class="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
		              >
		                <input
		                  v-model="selectedCategories"
		                  type="checkbox"
		                  :value="c.slug"
		                  class="mt-0.5 h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
		                >
		                <span class="min-w-0">
		                  <span class="block font-semibold text-gray-100">{{ c.name }}</span>
		                  <span v-if="c.description" class="mt-0.5 block text-xs text-gray-400 line-clamp-2">{{ c.description }}</span>
		                </span>
		              </label>
		            </div>
		          </div>
		        </div>
		      </div>

		      <!-- Tab: Regulations -->
		      <div v-show="activeTab === 'regulations'" class="space-y-4">
		        <div class="flex items-center justify-between gap-3">
		          <div>
		            <div class="text-sm font-semibold text-gray-200">Regulations</div>
		            <div class="mt-0.5 text-xs text-gray-400">Compliance and enforcement coverage.</div>
		          </div>
		          <div class="text-xs text-gray-500">
		            <span class="font-mono text-gray-300">{{ selectedRegulations.length }}</span> selected
		          </div>
		        </div>
		        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		          <label
		            v-for="r in regulationOptions"
		            :key="r"
		            class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
		          >
		            <input
		              v-model="selectedRegulations"
		              type="checkbox"
		              :value="r"
		              class="h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
		            >
		            <span class="font-semibold text-gray-100">{{ r }}</span>
		          </label>
		        </div>
		        <div>
		          <label class="block text-sm text-gray-300" for="reg-other">Other</label>
		          <input
		            id="reg-other"
		            v-model.trim="regulationOther"
		            type="text"
		            placeholder="e.g., SOC 2"
		            class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
		          >
		        </div>
		      </div>

		      <!-- Tab: Regions -->
		      <div v-show="activeTab === 'regions'" class="space-y-4">
		        <div class="flex items-center justify-between gap-3">
		          <div>
		            <div class="text-sm font-semibold text-gray-200">Regions</div>
		            <div class="mt-0.5 text-xs text-gray-400">Where your legal/regulatory focus is.</div>
		          </div>
		          <div class="text-xs text-gray-500">
		            <span class="font-mono text-gray-300">{{ selectedJurisdictions.length }}</span> selected
		          </div>
		        </div>
		        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		          <label
		            v-for="j in jurisdictionOptions"
		            :key="j"
		            class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
		          >
		            <input
		              v-model="selectedJurisdictions"
		              type="checkbox"
		              :value="j"
		              class="h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
		            >
		            <span class="font-semibold text-gray-100">{{ j }}</span>
		          </label>
		        </div>
		        <div>
		          <label class="block text-sm text-gray-300" for="jur-other">Other</label>
		          <input
		            id="jur-other"
		            v-model.trim="jurisdictionOther"
		            type="text"
		            placeholder="e.g., Canada"
		            class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
		          >
		        </div>
		      </div>

		      <!-- Tab: Custom -->
		      <div v-show="activeTab === 'custom'" class="space-y-5">
		        <div>
		          <div class="text-sm font-semibold text-gray-200">Company / Industry</div>
		          <div class="mt-0.5 text-xs text-gray-400">Specific monitoring for companies and sectors.</div>
		        </div>
		        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		          <div>
		            <label class="block text-sm text-gray-300" for="companies">Companies</label>
		            <input
		              id="companies"
		              v-model.trim="companies"
		              type="text"
		              placeholder="e.g., Okta, Microsoft"
		              class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
		            >
		          </div>
		          <div>
		            <label class="block text-sm text-gray-300" for="industries">Industries</label>
		            <input
		              id="industries"
		              v-model.trim="industries"
		              type="text"
		              placeholder="e.g., Fintech, Healthcare"
		              class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
		            >
		          </div>
		        </div>
		        <p class="text-xs text-gray-400">Enter names separated by commas. We’ll set up specific monitoring.</p>

		        <div class="flex items-center justify-between gap-3 pt-1">
		          <div>
		            <div class="text-sm font-semibold text-gray-200">IoC types</div>
		            <div class="mt-0.5 text-xs text-gray-400">Indicators of Compromise you want extracted.</div>
		          </div>
		          <div class="text-xs text-gray-500">
		            <span class="font-mono text-gray-300">{{ selectedIocTypes.length }}</span> selected
		          </div>
		        </div>
		        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		          <label
		            v-for="t in iocTypeOptions"
		            :key="t.value"
		            class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
		          >
		            <input
		              v-model="selectedIocTypes"
		              type="checkbox"
		              :value="t.value"
		              class="h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
		            >
		            <span class="font-semibold text-gray-100">{{ t.label }}</span>
		          </label>
		        </div>
		      </div>
		    </div>
		  </div>
        </section>

        <!-- Section 3: Channel -->
	      <section class="glass-panel rounded-2xl p-6 md:p-7">
          <div class="flex flex-col gap-1">
	          <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">How do you want to be notified?</h2>
	          <p class="text-sm text-tn-on-surface-variant">Choose a channel and add configuration if needed.</p>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label v-for="opt in channelOptions" :key="opt.value" class="block">
              <input
                v-model="channel"
                type="radio"
                name="channel"
                :value="opt.value"
                class="sr-only"
                :disabled="opt.disabled"
              >

              <div
	                class="rounded-2xl p-4 transition ring-1 ring-white/10"
                :class="cardClassFor(opt)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold" :class="opt.disabled ? 'text-gray-500' : 'text-gray-100'">
                      {{ opt.label }}
                    </div>
                    <div class="mt-1 text-xs" :class="opt.disabled ? 'text-gray-600' : 'text-gray-400'">
                      {{ opt.description }}
                    </div>
                  </div>
                  <span
                    v-if="opt.badge"
	                    class="shrink-0 rounded-full bg-black/20 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-[0.2em] ring-1 ring-white/10"
                    :class="opt.disabled ? 'text-gray-500' : 'text-gray-300'"
                  >
                    {{ opt.badge }}
                  </span>
                </div>
              </div>
            </label>
          </div>

          <!-- Conditional configs -->
	          <div class="mt-5 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
	            <div v-if="channel === 'email'" class="text-sm text-tn-on-surface-variant">
              Notifications will be sent to your signup email.
            </div>

            <div v-else-if="channel === 'discord'" class="space-y-2">
	              <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="discord-webhook">Webhook URL</label>
              <input
                id="discord-webhook"
                v-model.trim="discordWebhookUrl"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
	                class="w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
              >
	              <p class="text-xs text-tn-on-surface-variant">Create a webhook in your Discord server settings → Integrations → Webhooks</p>
              <p v-if="discordWebhookUrl && !discordWebhookValid" class="text-xs text-red-300">Please enter a valid https:// URL.</p>
            </div>

            <div v-else-if="channel === 'telegram'" class="space-y-2">
	              <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="telegram-chat">Chat ID</label>
              <input
                id="telegram-chat"
                v-model.trim="telegramChatId"
                type="text"
                placeholder="123456789"
	                class="w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
              >
	              <p class="text-xs text-tn-on-surface-variant">Message the Telegram bot to get your chat ID</p>
            </div>

            <div v-else-if="channel === 'webhook'" class="space-y-2">
	              <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="generic-webhook">Endpoint URL</label>
              <input
                id="generic-webhook"
                v-model.trim="webhookEndpointUrl"
                type="url"
					placeholder="https://example.com/webhook"
	                class="w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
              >
	              <p class="text-xs text-tn-on-surface-variant">We’ll POST JSON to this URL for each matching article</p>
              <p v-if="webhookEndpointUrl && !webhookEndpointValid" class="text-xs text-red-300">Please enter a valid https:// URL.</p>
            </div>

            <div v-else-if="channel === 'api'" class="space-y-3">
	              <div class="text-sm text-tn-on-surface-variant">Request API access for programmatic notifications.</div>

	              <button
                type="button"
	                class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="apiRequestOpen = !apiRequestOpen"
              >
                {{ apiRequestOpen ? 'Hide request form' : 'Request API Access' }}
              </button>

	              <div v-if="apiRequestOpen" class="space-y-3 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div>
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="api-company">Company</label>
                  <input
                    id="api-company"
                    v-model.trim="apiCompany"
                    type="text"
                    placeholder="Your company"
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  >
                </div>

                <div>
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="api-usecase">Use case</label>
                  <textarea
                    id="api-usecase"
                    v-model.trim="apiUseCase"
                    rows="4"
                    placeholder="What will you use the API for?"
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  />
                </div>

                <div class="flex flex-wrap items-center gap-3">
	                  <button
                    type="button"
	                    class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="apiSubmitting || !emailValid || !apiCompany || !apiUseCase"
                    @click="submitApiRequest"
                  >
                    {{ apiSubmitting ? 'Submitting…' : 'Submit request' }}
                  </button>

                  <span v-if="apiSuccess" class="text-xs text-green-200">Request sent. We’ll review and send you an API key.</span>
	                  <span v-else class="text-xs text-tn-on-surface-variant">We’ll review and send you an API key</span>
                </div>

	                <div v-if="apiError" class="text-xs text-red-200">{{ apiError }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 4: Submit -->
	      <section class="glass-panel rounded-2xl p-6 md:p-7">
          <button
            type="submit"
	          class="w-full rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading || !canSubmit"
          >
            {{ loading ? 'Subscribing…' : 'Subscribe' }}
          </button>
	        <p class="mt-3 text-xs text-tn-on-surface-variant">
            By subscribing you agree to receive notifications based on your preferences. You can unsubscribe anytime.
          </p>
        </section>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useAuthGate } from '~/composables/useAuthGate'

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
}

type Channel = 'email' | 'discord' | 'telegram' | 'webhook' | 'api' | 'x'

definePageMeta({ layout: 'default' })
	const site = useSiteConfig()
useSeoMeta({
	  title: `Subscribe — ${site.name}`,
	  description: `Subscribe to ${site.name} notifications and tailor what you care about.`
})

const { authenticated } = useAuthGate()
	const nuxtApp = useNuxtApp()
	const trackEvent = (nuxtApp as {
		$trackEvent?: (type: string, metadata?: Record<string, unknown>) => Promise<void>
	}).$trackEvent

const email = ref('')

const selectedCategories = ref<string[]>([])
const selectedRegulations = ref<string[]>([])
const regulationOther = ref('')
const selectedJurisdictions = ref<string[]>([])
const jurisdictionOther = ref('')
const companies = ref('')
const industries = ref('')
const selectedIocTypes = ref<string[]>([])

	type PreferencesTab = 'topics' | 'regulations' | 'regions' | 'custom'

	// UI-only controls. These do not affect submission payload.
	const allUpdates = ref(true)
	const activeTab = ref<PreferencesTab>('topics')

	const tabCounts = computed(() => {
		const regulationsOther = regulationOther.value.trim() ? 1 : 0
		const jurisdictionsOther = jurisdictionOther.value.trim() ? 1 : 0
		const customTextCount = (companies.value.trim() ? 1 : 0) + (industries.value.trim() ? 1 : 0)

		return {
			topics: selectedCategories.value.length,
			regulations: selectedRegulations.value.length + regulationsOther,
			regions: selectedJurisdictions.value.length + jurisdictionsOther,
			custom: selectedIocTypes.value.length + customTextCount
		}
	})

const channel = ref<Channel>('email')
const discordWebhookUrl = ref('')
const telegramChatId = ref('')
const webhookEndpointUrl = ref('')

const apiRequestOpen = ref(false)
const apiCompany = ref('')
const apiUseCase = ref('')
const apiSubmitting = ref(false)
const apiSuccess = ref(false)
const apiError = ref<string | null>(null)

const loading = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const emailValid = computed(() => {
  const v = (email.value || '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
})

function isHttpsUrl(value: string): boolean {
  const input = (value || '').trim()
  if (!input) return false
  try {
    const u = new URL(input)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

const discordWebhookValid = computed(() => isHttpsUrl(discordWebhookUrl.value))
const webhookEndpointValid = computed(() => isHttpsUrl(webhookEndpointUrl.value))

const canSubmit = computed(() => {
  if (!emailValid.value) return false
  if (channel.value === 'discord') return discordWebhookValid.value
  if (channel.value === 'telegram') return !!telegramChatId.value.trim()
  if (channel.value === 'webhook') return webhookEndpointValid.value
  if (channel.value === 'x') return false
  return true
})

const regulationOptions = [
  'GDPR',
  'CCPA/CPRA',
  'HIPAA',
  'NIS2',
  'PCI-DSS',
  'DORA',
  'EU AI Act',
  'Cyber Resilience Act',
  'EU Cybersecurity Act',
  'NIST',
  'SEC Cyber Rules',
  'UK Data Protection',
  'ISO 27001'
]

const jurisdictionOptions = [
  'EU',
  'US',
  'UK',
  'France',
  'Germany',
  'Netherlands',
  'Sweden',
  'Australia',
  'Singapore',
  'South Korea',
  'Japan',
  'Brazil',
  'China'
]

const iocTypeOptions: Array<{ label: string; value: string }> = [
  { label: 'CVEs', value: 'cve' },
  { label: 'IP Addresses', value: 'ip' },
  { label: 'Domains', value: 'domain' },
  { label: 'Malware Names', value: 'malware' },
  { label: 'Hashes (MD5/SHA-1/SHA-256)', value: 'hashes' },
  { label: 'MITRE ATT&CK', value: 'mitre_attack' }
]

const channelOptions: Array<{
  value: Channel
  label: string
  description: string
  badge?: string
  disabled?: boolean
}> = [
  { value: 'email', label: 'Email', description: 'Notifications sent to your signup email' },
  { value: 'discord', label: 'Discord', description: 'Post updates via a Discord webhook URL' },
  { value: 'telegram', label: 'Telegram', description: 'Send notifications to a Telegram chat' },
  { value: 'webhook', label: 'Webhook', description: 'POST JSON to your endpoint for each matching article' },
  { value: 'api', label: 'API Access', description: 'Request access for programmatic notifications' },
  { value: 'x', label: 'X / Twitter', description: 'Coming soon', badge: 'Coming soon', disabled: true }
]

function cardClassFor(opt: { value: Channel; disabled?: boolean }): string {
	if (opt.disabled) return 'bg-black/10 opacity-60'
  const active = channel.value === opt.value
  return active
	  ? 'bg-white/[0.06] ring-tn-primary/35'
	  : 'bg-black/20 hover:bg-white/[0.03]'
}

const { data: categoriesData, pending: categoriesPending, error: categoriesError } = await useFetch<{
  items: Category[]
}>('/api/categories')

const categories = computed(() => (categoriesData.value?.items ?? []) as Category[])

const slugsByGroup = {
  technical: new Set([
    'vulnerabilities',
    'zero-day',
    'malware',
    'ransomware',
    'supply-chain',
    'cryptography',
    'cloud-security',
	    'ai-security',
	    'iot-ot'
  ]),
  regulatory: new Set([
    'gdpr',
    'ccpa-cpra',
    'hipaa',
    'nis2',
    'pci-dss',
    'dora',
    'eu-ai-act',
    'privacy-fines',
    'compliance',
    'privacy',
    'policy'
  ]),
  operational: new Set([
    'tools',
    'open-source',
    'threat-intelligence',
    'incident-response',
    'identity-access',
    'nation-state',
    'breaches'
  ])
}

const categoryGroups = computed(() => {
  const all = categories.value
  const technical: Category[] = []
  const regulatory: Category[] = []
  const operational: Category[] = []
  const other: Category[] = []

  for (const c of all) {
    if (slugsByGroup.technical.has(c.slug)) technical.push(c)
    else if (slugsByGroup.regulatory.has(c.slug)) regulatory.push(c)
    else if (slugsByGroup.operational.has(c.slug)) operational.push(c)
    else other.push(c)
  }

  const groups = [
    { key: 'technical', title: 'Technical', items: technical },
    { key: 'regulatory', title: 'Regulatory', items: regulatory },
    { key: 'operational', title: 'Operational', items: operational },
    { key: 'other', title: 'Other', items: other }
  ]

  return groups.filter((g) => g.items.length > 0)
})

function parseCommaList(value: string): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeIocTypes(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if (v === 'hashes') {
      out.push('hash_md5', 'hash_sha1', 'hash_sha256')
    } else {
      out.push(v)
    }
  }
  return Array.from(new Set(out))
}

function getErrorText(err: unknown): string {
  if (!err) return 'Unknown error.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message

  const e = err as Record<string, unknown>
  const data = e?.data as Record<string, unknown> | undefined
  const statusMessage = typeof data?.statusMessage === 'string' ? data.statusMessage : null
  const message = typeof e?.message === 'string' ? (e.message as string) : null
  return statusMessage || message || 'Unknown error.'
}

async function submitApiRequest() {
  apiError.value = null
  apiSuccess.value = false

  if (!emailValid.value) {
    apiError.value = 'Please enter a valid email address first.'
    return
  }
  if (!apiCompany.value.trim() || !apiUseCase.value.trim()) {
    apiError.value = 'Please provide company and use case.'
    return
  }

  apiSubmitting.value = true
  try {
    await $fetch('/api/subscribe/api-request', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        company: apiCompany.value.trim(),
        use_case: apiUseCase.value.trim()
      }
    })
    apiSuccess.value = true
  } catch (e) {
    apiError.value = getErrorText(e)
  } finally {
    apiSubmitting.value = false
  }
}

async function submit() {
  successMessage.value = null
  errorMessage.value = null

  if (!canSubmit.value) {
    errorMessage.value = 'Please complete the required fields before subscribing.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/subscribe', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        preferences: {
          categories: selectedCategories.value,
          regulations: selectedRegulations.value,
          regulation_other: regulationOther.value.trim() || null,
          jurisdictions: selectedJurisdictions.value,
          jurisdiction_other: jurisdictionOther.value.trim() || null,
          companies: parseCommaList(companies.value),
          industries: parseCommaList(industries.value),
          ioc_types: normalizeIocTypes(selectedIocTypes.value)
        },
        channel: {
          type: channel.value,
          discord_webhook_url: channel.value === 'discord' ? discordWebhookUrl.value.trim() : null,
          telegram_chat_id: channel.value === 'telegram' ? telegramChatId.value.trim() : null,
          webhook_endpoint_url: channel.value === 'webhook' ? webhookEndpointUrl.value.trim() : null
        }
      }
    })

    successMessage.value = 'Check your email to verify your subscription!'
		void trackEvent?.('email_signup', { channel: channel.value })
  } catch (e: unknown) {
    const text = getErrorText(e)
    // If backend returns 409 for duplicates, keep the ticket's wording.
    const statusCode = typeof (e as Record<string, unknown>)?.statusCode === 'number'
      ? ((e as Record<string, unknown>).statusCode as number)
      : null
    if (statusCode === 409) {
      errorMessage.value = "You're already subscribed. Check your email for a verification link."
    } else {
      errorMessage.value = text
    }
  } finally {
    loading.value = false
  }
}
</script>
