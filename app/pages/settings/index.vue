<template>
	<main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
	    <section class="glass-panel rounded-3xl p-6 md:p-10">
	      <div class="flex items-center gap-3">
	        <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	        <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Settings</div>
	      </div>
	      <h1 class="mt-3 font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-4xl">Your dashboard</h1>
	      <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          Manage notification preferences, channels, and your recent notification history.
        </p>
      </section>

	    <section v-if="!user" class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
	      <div class="flex items-center gap-3">
	        <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	        <div class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Sign in required</div>
	      </div>
	      <p class="mt-2 text-sm text-tn-on-surface-variant">Please sign in to view your settings.</p>
	      <div class="mt-6">
          <NuxtLink
            :to="loginHref"
	          class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
          >
	          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            Log in
          </NuxtLink>
        </div>
      </section>

	      <template v-else>
	        <section v-if="loading" class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
	          <div class="text-sm text-tn-on-surface-variant">Loading your settings…</div>
	        </section>

	        <section v-else-if="errorMessage" class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
	          <div class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Could not load settings</div>
	          <p class="mt-2 text-sm text-tn-on-surface-variant">{{ errorMessage }}</p>
          <button
            type="button"
	            class="mt-6 inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            @click="load"
          >
            Retry
          </button>
        </section>

        <template v-else>
          <!-- Section 1: Profile -->
	          <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
            <div class="flex items-start justify-between gap-4">
              <div>
	                <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Profile</h2>
	                <p class="mt-1 text-sm text-tn-on-surface-variant">Your account details.</p>
              </div>
	              <NuxtLink to="/auth/reset-password" class="text-sm text-tn-primary hover:opacity-90">
                Change password
              </NuxtLink>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
	                <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="settings-email">Email</label>
                <input
                  id="settings-email"
                  :value="settings?.subscriber.email"
                  type="email"
                  disabled
	                  class="mt-2 w-full cursor-not-allowed rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface-variant ring-1 ring-white/10 opacity-70"
                >
              </div>
              <div>
	                <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="settings-name">Name</label>
                <input
                  id="settings-name"
                  v-model.trim="profileName"
                  type="text"
                  placeholder="Your name"
	                  class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                >
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
	                class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
                :disabled="profileSaving"
                @click="saveProfile"
              >
                {{ profileSaving ? 'Saving…' : 'Save profile' }}
              </button>
              <div v-if="profileSaved" class="text-sm text-green-300">Saved.</div>
              <div v-if="profileError" class="text-sm text-red-300">{{ profileError }}</div>
            </div>
          </section>

          <!-- Section 2: Notification Preferences -->
	          <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
	                <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Notification preferences</h2>
	                <p class="mt-1 text-sm text-tn-on-surface-variant">Choose what you want to hear about.</p>
              </div>
              <button
                type="button"
	                class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="prefsEditOpen = !prefsEditOpen"
              >
                {{ prefsEditOpen ? 'Close editor' : 'Edit preferences' }}
              </button>
            </div>

            <div v-if="!prefsEditOpen" class="mt-5">
	              <div v-if="!settings?.preferences.length" class="text-sm text-tn-on-surface-variant">No preferences set yet.</div>
              <div v-else class="space-y-3">
	                <div v-for="g in preferenceGroups" :key="g.key" class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
	                  <div class="text-sm font-semibold text-tn-on-surface">{{ g.title }}</div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      v-for="v in g.values"
                      :key="v"
	                      class="rounded-full bg-black/20 px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10"
                    >
                      {{ v }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mt-5 space-y-3">
              <!-- Select all / Clear all -->
              <div class="flex items-center gap-3">
                <button
                  type="button"
	                  class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
                  @click="selectAllPreferences"
                >
                  Select all
                </button>
                <button
                  type="button"
	                  class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                  @click="clearAllPreferences"
                >
                  Clear all
                </button>
              </div>

              <!-- Categories -->
	              <details class="group rounded-2xl bg-black/20 p-4 ring-1 ring-white/10" open>
                <summary class="cursor-pointer list-none select-none">
                  <div class="flex items-center justify-between gap-3">
                    <div>
	                      <div class="text-sm font-semibold text-tn-on-surface">Categories</div>
	                      <div class="mt-0.5 text-xs text-tn-on-surface-variant">Pick topics you want monitored.</div>
                    </div>
	                    <div class="text-xs text-tn-on-surface-variant">
	                      <span class="font-mono text-tn-on-surface">{{ interests.categories.length }}</span> selected
                    </div>
                  </div>
                </summary>

                <div class="mt-4 space-y-5">
                  <div v-if="categoriesPending" class="text-sm text-gray-400">Loading categories…</div>
                  <div v-else-if="categoriesError" class="text-sm text-gray-400">Could not load categories.</div>

                  <div v-else class="space-y-5">
                    <div v-for="group in categoryGroups" :key="group.key" class="space-y-2">
	                      <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">{{ group.title }}</div>
                      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <label
                          v-for="c in group.items"
                          :key="c.slug"
	                          class="flex items-start gap-2 rounded-xl bg-black/20 px-3 py-3 text-sm text-tn-on-surface ring-1 ring-white/10 hover:bg-white/[0.04]"
                        >
                          <input
                            v-model="interests.categories"
                            type="checkbox"
                            :value="c.slug"
	                            class="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-tn-primary focus:ring-tn-primary/30"
                          >
                          <span class="min-w-0">
	                            <span class="block font-semibold text-tn-on-surface">{{ c.name }}</span>
	                            <span v-if="c.description" class="mt-0.5 block text-xs text-tn-on-surface-variant line-clamp-2">{{ c.description }}</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <!-- Regulations -->
              <details class="group rounded-xl border border-gray-800 bg-black/20 p-4">
                <summary class="cursor-pointer list-none select-none">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-sm font-semibold text-gray-200">Regulations</div>
                      <div class="mt-0.5 text-xs text-gray-400">Compliance and enforcement coverage.</div>
                    </div>
                    <div class="text-xs text-gray-500">
                      <span class="font-mono text-gray-300">{{ interests.regulations.length }}</span> selected
                    </div>
                  </div>
                </summary>

                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label
                    v-for="r in regulationOptions"
                    :key="r"
                    class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
                  >
                    <input
                      v-model="interests.regulations"
                      type="checkbox"
                      :value="r"
                      class="h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
                    >
                    <span class="font-semibold text-gray-100">{{ r }}</span>
                  </label>
                </div>

                <div class="mt-4">
                  <label class="block text-sm text-gray-300" for="reg-other">Other</label>
                  <input
                    id="reg-other"
                    v-model.trim="regulationOther"
                    type="text"
                    placeholder="e.g., SOC 2"
                    class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
                  >
                </div>
              </details>

              <!-- Jurisdictions -->
              <details class="group rounded-xl border border-gray-800 bg-black/20 p-4">
                <summary class="cursor-pointer list-none select-none">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-sm font-semibold text-gray-200">Jurisdictions</div>
                      <div class="mt-0.5 text-xs text-gray-400">Where your legal/regulatory focus is.</div>
                    </div>
                    <div class="text-xs text-gray-500">
                      <span class="font-mono text-gray-300">{{ interests.jurisdictions.length }}</span> selected
                    </div>
                  </div>
                </summary>

                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label
                    v-for="j in jurisdictionOptions"
                    :key="j"
                    class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.03]"
                  >
                    <input
                      v-model="interests.jurisdictions"
                      type="checkbox"
                      :value="j"
                      class="h-4 w-4 rounded border-gray-700 bg-black/40 text-gray-200"
                    >
                    <span class="font-semibold text-gray-100">{{ j }}</span>
                  </label>
                </div>

                <div class="mt-4">
                  <label class="block text-sm text-gray-300" for="jur-other">Other</label>
                  <input
                    id="jur-other"
                    v-model.trim="jurisdictionOther"
                    type="text"
                    placeholder="e.g., Canada"
                    class="mt-2 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
                  >
                </div>
              </details>

              <!-- Companies / industries / freetext -->
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div class="rounded-xl border border-gray-800 bg-black/20 p-4">
                  <div class="text-sm font-semibold text-gray-200">Companies</div>
                  <div class="mt-1 text-xs text-gray-400">Comma-separated.</div>
                  <input
                    v-model.trim="companiesText"
                    type="text"
                    placeholder="e.g., Okta, Microsoft"
                    class="mt-3 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
                  >
                </div>
                <div class="rounded-xl border border-gray-800 bg-black/20 p-4">
                  <div class="text-sm font-semibold text-gray-200">Industries</div>
                  <div class="mt-1 text-xs text-gray-400">Comma-separated.</div>
                  <input
                    v-model.trim="industriesText"
                    type="text"
                    placeholder="e.g., Fintech, Healthcare"
                    class="mt-3 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
                  >
                </div>
              </div>

              <div class="rounded-xl border border-gray-800 bg-black/20 p-4">
                <div class="text-sm font-semibold text-gray-200">Keywords</div>
                <div class="mt-1 text-xs text-gray-400">Add free-text terms (comma-separated).</div>
                <input
                  v-model.trim="freetextText"
                  type="text"
                  placeholder="e.g., Mandiant, CitrixBleed"
                  class="mt-3 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
                >
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-60"
                  :disabled="prefsSaving"
                  @click="savePreferences"
                >
                  {{ prefsSaving ? 'Saving…' : 'Save preferences' }}
                </button>
                <div v-if="prefsSaved" class="text-sm text-green-300">Saved.</div>
                <div v-if="prefsError" class="text-sm text-red-300">{{ prefsError }}</div>
              </div>
            </div>
          </section>

					<!-- Section 3: API Keys -->
					<section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
					  <div class="flex flex-wrap items-start justify-between gap-4">
					    <div>
					      <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">API Keys</h2>
			      <p class="mt-1 max-w-2xl text-sm text-tn-on-surface-variant">
			        Use API keys to authenticate with the {{ site.name }} MCP server and IOC API.
					      </p>
					    </div>
					    <button
					      type="button"
					      class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
					      :disabled="apiKeysLoading"
					      @click="openGenerateApiKey"
					    >
					      <UIcon name="i-heroicons-plus" class="h-4 w-4" />
					      Generate New Key
					    </button>
					  </div>

					  <div v-if="apiKeysLoading" class="mt-5 text-sm text-tn-on-surface-variant">Loading API keys…</div>
					  <div v-else-if="apiKeysError" class="mt-5 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
					    <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Could not load API keys</div>
					    <p class="mt-2 text-sm text-tn-on-surface-variant">{{ apiKeysError }}</p>
					    <button
					      type="button"
					      class="mt-4 inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
					      @click="loadApiKeys"
					    >
					      Retry
					    </button>
					  </div>

					  <div v-else class="mt-5 overflow-x-auto">
					    <table class="w-full min-w-[720px] text-left text-sm">
					      <thead class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">
					        <tr class="border-b border-white/10">
					          <th class="px-2 py-2">Key</th>
					          <th class="px-2 py-2">Name</th>
					          <th class="px-2 py-2">Created</th>
					          <th class="px-2 py-2">Last Used</th>
					          <th class="px-2 py-2 text-right">Actions</th>
					        </tr>
					      </thead>
					      <tbody>
					        <tr v-if="apiKeys.length === 0" class="border-b border-white/10">
					          <td colspan="5" class="px-2 py-4 text-sm text-tn-on-surface-variant">No API keys yet.</td>
					        </tr>
					        <tr
					          v-for="k in apiKeys"
					          :key="k.id"
					          class="border-b border-white/10 hover:bg-white/[0.03]"
					          :class="k.revoked_at ? 'opacity-60' : ''"
					        >
					          <td class="px-2 py-3 font-mono text-xs text-tn-on-surface" :class="k.revoked_at ? 'line-through decoration-white/20' : ''">
					            {{ k.prefix || '—' }}
					          </td>
					          <td class="px-2 py-3">
					            <div class="text-sm text-tn-on-surface" :class="k.revoked_at ? 'line-through decoration-white/20' : ''">
					              {{ k.name || '—' }}
					            </div>
					          </td>
					          <td class="px-2 py-3 text-xs text-tn-on-surface-variant">
					            {{ formatShortDate(k.created_at) }}
					          </td>
					          <td class="px-2 py-3 text-xs text-tn-on-surface-variant">
					            {{ k.last_used_at ? timeAgo(k.last_used_at) : 'Never' }}
					          </td>
					          <td class="px-2 py-3">
					            <div class="flex items-center justify-end gap-2">
					              <span
					                v-if="k.revoked_at"
					                class="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant"
					              >
					                Revoked
					              </span>
					              <button
					                v-else
					                type="button"
					                class="rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest disabled:opacity-60"
					                :disabled="revokeBusyId === k.id"
					                @click="openRevokeApiKey(k)"
					              >
					                {{ revokeBusyId === k.id ? 'Revoking…' : 'Revoke' }}
					              </button>
					            </div>
					          </td>
					        </tr>
					      </tbody>
					    </table>
					  </div>

					  <!-- Generate API key modal -->
					  <ClientOnly>
					    <UModal v-model:open="generateOpen" title="Generate API key" description="Name this key so you can identify it later.">
					      <template #content>
					        <div class="space-y-5">
					          <div class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
					            <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="api-key-name">
					              Name
					            </label>
					            <input
					              id="api-key-name"
					              v-model.trim="generateName"
					              type="text"
					              placeholder="My laptop"
					              class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
					            >
					          </div>

					          <div v-if="generateError" class="rounded-2xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-200">
					            {{ generateError }}
					          </div>

					          <div v-if="generatedKey" class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
					            <div class="flex items-start justify-between gap-3">
					              <div class="min-w-0">
					                <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Your new API key</div>
					                <p class="mt-1 text-xs text-tn-on-surface-variant">
					                  Copy this key now. You won’t see it again.
					                </p>
					              </div>
					              <button
					                type="button"
					                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
					                @click="copyToClipboard(generatedKey)"
					              >
					                Copy
					              </button>
					            </div>
					            <div class="mt-3 rounded-xl bg-tn-surface-lowest/60 px-3 py-3 font-mono text-xs text-tn-on-surface ring-1 ring-white/10">
					              {{ generatedKey }}
					            </div>
					          </div>

					          <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
					            <UButton color="neutral" variant="ghost" :disabled="generating" @click="generateOpen = false">
					              Close
					            </UButton>
					            <UButton
					              v-if="!generatedKey"
					              :loading="generating"
					              :disabled="!generateName.trim()"
					              @click="generateApiKey"
					            >
					              Generate
					            </UButton>
					          </div>
					        </div>
					      </template>
					    </UModal>

					    <!-- Revoke confirmation modal -->
					    <UModal v-model:open="revokeOpen" title="Revoke API key" description="Any integrations using it will stop working.">
					      <template #content>
					        <div class="space-y-4">
					          <p class="text-sm text-tn-on-surface-variant">
					            Revoke <span class="font-mono text-tn-on-surface">{{ revokeTarget?.prefix || 'this key' }}</span>?
					          </p>
					          <div v-if="revokeError" class="rounded-2xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-200">
					            {{ revokeError }}
					          </div>
					          <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
					            <UButton color="neutral" variant="ghost" :disabled="revoking" @click="revokeOpen = false">Cancel</UButton>
					            <UButton color="error" variant="outline" :loading="revoking" @click="confirmRevoke">
					              Revoke
					            </UButton>
					          </div>
					        </div>
					      </template>
					    </UModal>
					  </ClientOnly>
					</section>

	          <!-- Section 4: Notification Channels -->
	          <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
	                <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Notification channels</h2>
	                <p class="mt-1 text-sm text-tn-on-surface-variant">Add and remove delivery endpoints.</p>
              </div>
              <button
                type="button"
	                class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="addChannelOpen = !addChannelOpen"
              >
                {{ addChannelOpen ? 'Close' : 'Add channel' }}
              </button>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
	              <div
                v-for="c in settings?.channels"
                :key="c.id"
	                class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
	                    <div class="text-sm font-semibold text-tn-on-surface">{{ channelLabel(c.channel_type) }}</div>
	                    <div class="mt-1 text-xs text-tn-on-surface-variant">{{ channelDetail(c) }}</div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      :class="channelStatusClass(c)"
                    >
                      {{ channelStatusText(c) }}
                    </span>
                  </div>
                </div>

                <div class="mt-4 flex items-center justify-end">
	                  <button
                    type="button"
	                    class="rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest disabled:opacity-60"
                    :disabled="channelRemovingId === c.id"
                    @click="removeChannel(c.id)"
                  >
                    {{ channelRemovingId === c.id ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </div>

	              <div v-if="!settings?.channels?.length" class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
	                <div class="text-sm text-tn-on-surface-variant">No channels configured yet.</div>
              </div>
            </div>

	            <div v-if="addChannelOpen" class="mt-6 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="channel-type">Type</label>
                  <select
                    id="channel-type"
                    v-model="newChannelType"
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  >
                    <option value="email">Email</option>
                    <option value="discord">Discord</option>
                    <option value="telegram">Telegram</option>
                    <option value="webhook">Webhook</option>
                    <option value="api">API</option>
                  </select>
                </div>

                <div v-if="newChannelType === 'discord'">
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="discord-webhook">Webhook URL</label>
                  <input
                    id="discord-webhook"
                    v-model.trim="newDiscordWebhookUrl"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  >
                </div>

                <div v-else-if="newChannelType === 'telegram'">
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="telegram-chat">Chat ID</label>
                  <input
                    id="telegram-chat"
                    v-model.trim="newTelegramChatId"
                    type="text"
                    placeholder="123456789"
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  >
                </div>

                <div v-else-if="newChannelType === 'webhook'">
	                  <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="webhook-url">Endpoint URL</label>
                  <input
                    id="webhook-url"
                    v-model.trim="newWebhookEndpointUrl"
                    type="url"
								placeholder="https://example.com/webhook"
	                    class="mt-2 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-tn-on-surface placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
                  >
                </div>

                <div v-else class="md:col-span-1">
	                  <div class="text-sm text-tn-on-surface-variant">
                    <template v-if="newChannelType === 'email'">Uses your account email ({{ settings?.subscriber.email }}).</template>
                    <template v-else>API key will be generated automatically.</template>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-3">
	                <button
                  type="button"
	                  class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
                  :disabled="channelAdding"
                  @click="addChannel"
                >
                  {{ channelAdding ? 'Adding…' : 'Add channel' }}
                </button>
	                <div v-if="channelAddError" class="text-sm text-red-200">{{ channelAddError }}</div>
                <div v-if="apiKeyCreated" class="text-sm text-green-300">
                  API key created: <span class="font-mono">{{ apiKeyCreated }}</span>
                </div>
              </div>
            </div>
          </section>

	          <!-- Section 5: Recent Notifications -->
	          <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
	            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Recent notifications</h2>
	            <p class="mt-1 text-sm text-tn-on-surface-variant">Last 20 deliveries.</p>

            <div class="mt-5 overflow-x-auto">
	              <table class="w-full text-left text-sm">
	                <thead class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">
	                  <tr class="border-b border-white/10">
                    <th class="px-2 py-2">Date</th>
                    <th class="px-2 py-2">Article</th>
                    <th class="px-2 py-2">Channel</th>
                    <th class="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
	                  <tr v-if="!settings?.notifications.length" class="border-b border-white/10">
	                    <td colspan="4" class="px-2 py-4 text-sm text-tn-on-surface-variant">No notifications yet.</td>
                  </tr>
                  <tr
                    v-for="n in settings?.notifications"
                    :key="n.id"
	                    class="border-b border-white/10 hover:bg-white/[0.03]"
                  >
	                    <td class="px-2 py-3 text-xs text-tn-on-surface-variant">{{ formatDate(n.sent_at) }}</td>
                    <td class="px-2 py-3">
                      <a
                        v-if="n.article_url"
                        :href="safeHref(n.article_url)"
                        target="_blank"
                        rel="noopener noreferrer"
	                        class="font-medium text-tn-on-surface hover:underline hover:decoration-white/20"
                      >
                        {{ n.article_title || 'Untitled' }}
                      </a>
	                      <span v-else class="text-tn-on-surface-variant">{{ n.article_title || 'Untitled' }}</span>
                    </td>
	                    <td class="px-2 py-3 text-xs text-tn-on-surface-variant">{{ channelLabel(n.channel_type) }}</td>
                    <td class="px-2 py-3">
                      <span
	                        class="rounded-full border px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.2em]"
                        :class="statusBadgeClass(n.status)"
                      >
                        {{ n.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

	          <!-- Section 6: Danger Zone -->
	          <section class="mt-8 glass-panel rounded-3xl p-6 ring-1 ring-red-500/20 md:p-8">
	            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-red-200">Danger zone</h2>
	            <p class="mt-1 text-sm text-red-200/70">These actions are destructive.</p>

            <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="rounded-xl border border-red-900/50 bg-black/20 p-4">
                <div class="text-sm font-semibold text-gray-100">Unsubscribe from all</div>
                <p class="mt-1 text-xs text-gray-400">Deletes all channels and clears preferences.</p>
                <button
                  type="button"
                  class="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-950/50 disabled:opacity-60"
                  :disabled="dangerBusy"
                  @click="unsubscribeAll"
                >
                  {{ dangerBusy ? 'Working…' : 'Unsubscribe from all' }}
                </button>
              </div>

              <div class="rounded-xl border border-red-900/50 bg-black/20 p-4">
                <div class="text-sm font-semibold text-gray-100">Delete my account</div>
                <p class="mt-1 text-xs text-gray-400">Permanently deletes your account and settings.</p>
                <button
                  type="button"
                  class="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-950/50 disabled:opacity-60"
                  :disabled="dangerBusy"
                  @click="deleteAccount"
                >
                  {{ dangerBusy ? 'Working…' : 'Delete my account' }}
                </button>
              </div>
            </div>

            <div v-if="dangerError" class="mt-4 text-sm text-red-200">{{ dangerError }}</div>
          </section>
        </template>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'
type Category = {
  id: string
  name: string
  slug: string
  description: string | null
}

type SettingsData = {
  subscriber: { id: string; email: string; name: string | null; verified: boolean }
  preferences: Array<{ preference_type: string; preference_value: string }>
  channels: Array<{
    id: string
    channel_type: string
    channel_config: Record<string, unknown>
    is_active: boolean
    verified: boolean
    consecutive_failures: number | null
  }>
  notifications: Array<{
    id: string
    article_title: string | null
    article_url: string | null
    channel_type: string
    status: string
    sent_at: string
  }>
}

type ApiKeyItem = {
  id: string
  prefix: string
  name: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

type Interests = {
  categories: string[]
  regulations: string[]
  jurisdictions: string[]
  companies: string[]
  industries: string[]
  freetext: string[]
}

definePageMeta({ layout: 'default' })
	const site = useSiteConfig()
useSeoMeta({
	  title: `Settings — ${site.name}`,
	  description: `Manage your ${site.name} notification preferences and channels.`
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()

const loginHref = computed(() => `/auth/login?redirect=${encodeURIComponent(route.fullPath)}`)

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const settings = ref<SettingsData | null>(null)

// API Keys
const apiKeys = ref<ApiKeyItem[]>([])
const apiKeysLoading = ref(false)
const apiKeysError = ref<string | null>(null)

const generateOpen = ref(false)
const generateName = ref('')
const generating = ref(false)
const generatedKey = ref<string | null>(null)
const generateError = ref<string | null>(null)

const revokeOpen = ref(false)
const revokeTarget = ref<ApiKeyItem | null>(null)
const revoking = ref(false)
const revokeError = ref<string | null>(null)
const revokeBusyId = ref<string | null>(null)

// Profile
const profileName = ref('')
const profileSaving = ref(false)
const profileSaved = ref(false)
const profileError = ref<string | null>(null)

// Preferences
const prefsEditOpen = ref(false)
const prefsSaving = ref(false)
const prefsSaved = ref(false)
const prefsError = ref<string | null>(null)

const interests = reactive<Interests>({
  categories: [],
  regulations: [],
  jurisdictions: [],
  companies: [],
  industries: [],
  freetext: []
})

const regulationOther = ref('')
const jurisdictionOther = ref('')
const companiesText = ref('')
const industriesText = ref('')
const freetextText = ref('')

// Channels
const addChannelOpen = ref(false)
const newChannelType = ref<'email' | 'discord' | 'telegram' | 'webhook' | 'api'>('email')
const newDiscordWebhookUrl = ref('')
const newTelegramChatId = ref('')
const newWebhookEndpointUrl = ref('')
const channelAdding = ref(false)
const channelAddError = ref<string | null>(null)
const apiKeyCreated = ref<string | null>(null)
const channelRemovingId = ref<string | null>(null)

// Danger
const dangerBusy = ref(false)
const dangerError = ref<string | null>(null)

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

function getErrorText(err: unknown): string {
  if (!err) return 'Unknown error.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message

  const e = err as Record<string, unknown>
  const data = e?.data
  if (data && typeof data === 'object') {
    const statusMessage = (data as Record<string, unknown>).statusMessage
    if (typeof statusMessage === 'string' && statusMessage) return statusMessage
  }
  const message = e?.message
  if (typeof message === 'string' && message) return message
  return 'Unknown error.'
}

function formatShortDate(value: string): string {
  try {
    const d = new Date(value)
    // e.g. "Mar 24"
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }).replace(/^0/, '')
  } catch {
    return value
  }
}

function timeAgo(value: string): string {
  try {
    const then = new Date(value).getTime()
    const now = Date.now()
    const diffSec = Math.floor((now - then) / 1000)
    if (!Number.isFinite(diffSec)) return value
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  } catch {
    return value
  }
}

async function copyToClipboard(value: string) {
  if (!import.meta.client) return
  const v = (value || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
	    useToast().show('Copied')
  } catch {
	    useToast().show('Copy failed', 'error')
    window.prompt('Copy value:', v)
  }
}

function parseCommaList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function fillEditorFromPreferences(prefs: SettingsData['preferences']) {
  interests.categories = []
  interests.regulations = []
  interests.jurisdictions = []
  interests.companies = []
  interests.industries = []
  interests.freetext = []

  for (const p of prefs) {
    const type = (p.preference_type || '').trim()
    const value = (p.preference_value || '').trim()
    if (!value) continue

    if (type === 'category') interests.categories.push(value)
    else if (type === 'regulation') interests.regulations.push(value)
    else if (type === 'jurisdiction') interests.jurisdictions.push(value)
    else if (type === 'company') interests.companies.push(value)
    else if (type === 'industry') interests.industries.push(value)
    else if (type === 'freetext') interests.freetext.push(value)
  }

  companiesText.value = interests.companies.join(', ')
  industriesText.value = interests.industries.join(', ')
  freetextText.value = interests.freetext.join(', ')
  regulationOther.value = ''
  jurisdictionOther.value = ''
}

function selectAllPreferences() {
  interests.categories = categories.value.map((c) => c.slug)
  interests.regulations = [...regulationOptions]
  interests.jurisdictions = [...jurisdictionOptions]
}

function clearAllPreferences() {
  interests.categories = []
  interests.regulations = []
  interests.jurisdictions = []
  interests.companies = []
  interests.industries = []
  interests.freetext = []
  companiesText.value = ''
  industriesText.value = ''
  freetextText.value = ''
  regulationOther.value = ''
  jurisdictionOther.value = ''
}

async function load() {
  if (!user.value) return
  loading.value = true
  errorMessage.value = null
  try {
    const res = await $fetch<SettingsData>('/api/settings')
    settings.value = res
    profileName.value = res.subscriber.name || ''
    fillEditorFromPreferences(res.preferences)
  } catch (e) {
    errorMessage.value = getErrorText(e)
  } finally {
    loading.value = false
  }
}

async function loadApiKeys() {
  if (!user.value) return
  apiKeysLoading.value = true
  apiKeysError.value = null
  try {
    const res = await $fetch<{ items: ApiKeyItem[] } | ApiKeyItem[]>('/api/user/api-keys')
    const items = Array.isArray(res) ? res : res?.items
    apiKeys.value = Array.isArray(items) ? items : []
  } catch (e) {
    apiKeysError.value = getErrorText(e)
  } finally {
    apiKeysLoading.value = false
  }
}

watch(
  user,
  (u) => {
    if (!u) return
    load()
		loadApiKeys()
  },
  { immediate: true }
)

watch(
  generateOpen,
  async (isOpen) => {
    if (isOpen) return
    // When the modal closes, refresh list to ensure only prefixes are shown.
    if (user.value) await loadApiKeys()
  }
)

function openGenerateApiKey() {
  generateName.value = ''
  generatedKey.value = null
  generateError.value = null
  generateOpen.value = true
}

async function generateApiKey() {
  if (generating.value) return
  generateError.value = null

  const name = generateName.value.trim()
  if (!name) {
    generateError.value = 'Please provide a name for this key.'
    return
  }

  generating.value = true
  try {
    const res = await $fetch<{ apiKey?: ApiKeyItem; key?: string; api_key?: string; full_key?: string }>(
      '/api/user/api-keys',
      {
        method: 'POST',
        body: { name }
      }
    )

    const full = (res?.key || res?.api_key || res?.full_key || '').trim()
    if (!full) throw new Error('API key was created, but the full key was not returned. Please try again.')
    generatedKey.value = full

    if (res?.apiKey?.id) {
      // Best-effort: show it immediately in the table (prefix only).
      const exists = apiKeys.value.some((k) => k.id === res.apiKey!.id)
      if (!exists) apiKeys.value = [res.apiKey!, ...apiKeys.value]
    } else {
      await loadApiKeys()
    }
  } catch (e) {
    generateError.value = getErrorText(e)
  } finally {
    generating.value = false
  }
}

function openRevokeApiKey(k: ApiKeyItem) {
  revokeTarget.value = k
  revokeError.value = null
  revokeOpen.value = true
}

async function confirmRevoke() {
  if (!revokeTarget.value) return
  if (revoking.value) return

  revoking.value = true
  revokeError.value = null
  revokeBusyId.value = revokeTarget.value.id
  try {
    await $fetch(`/api/user/api-keys/${encodeURIComponent(revokeTarget.value.id)}`, { method: 'DELETE' })

    const nowIso = new Date().toISOString()
    apiKeys.value = apiKeys.value.map((k) => (k.id === revokeTarget.value!.id ? { ...k, revoked_at: nowIso } : k))
    revokeOpen.value = false
    revokeTarget.value = null
  } catch (e) {
    revokeError.value = getErrorText(e)
  } finally {
    revoking.value = false
    revokeBusyId.value = null
  }
}

async function saveProfile() {
  profileSaved.value = false
  profileError.value = null
  profileSaving.value = true
  try {
    const res = await $fetch<{ subscriber: SettingsData['subscriber'] }>('/api/settings/profile', {
      method: 'PUT',
      body: { name: profileName.value }
    })
    if (settings.value) settings.value.subscriber = res.subscriber
    profileSaved.value = true
    setTimeout(() => (profileSaved.value = false), 2500)
  } catch (e) {
    profileError.value = getErrorText(e)
  } finally {
    profileSaving.value = false
  }
}

const preferenceGroups = computed(() => {
  const prefs = settings.value?.preferences ?? []
  const map = new Map<string, string[]>()
  for (const p of prefs) {
    const t = (p.preference_type || '').trim()
    const v = (p.preference_value || '').trim()
    if (!t || !v) continue
    if (!map.has(t)) map.set(t, [])
    map.get(t)!.push(v)
  }

  const order: Array<{ key: string; title: string }> = [
    { key: 'category', title: 'Categories' },
    { key: 'regulation', title: 'Regulations' },
    { key: 'jurisdiction', title: 'Jurisdictions' },
    { key: 'company', title: 'Companies' },
    { key: 'industry', title: 'Industries' },
    { key: 'freetext', title: 'Keywords' }
  ]

  return order
    .map((o) => ({ key: o.key, title: o.title, values: (map.get(o.key) ?? []).slice().sort() }))
    .filter((g) => g.values.length)
})

async function savePreferences() {
  prefsSaved.value = false
  prefsError.value = null
  prefsSaving.value = true

  const categories = interests.categories.slice()
  const regulations = interests.regulations.slice()
  const jurisdictions = interests.jurisdictions.slice()
  const companies = parseCommaList(companiesText.value)
  const industries = parseCommaList(industriesText.value)
  const freetext = parseCommaList(freetextText.value)

  if (regulationOther.value.trim()) regulations.push(regulationOther.value.trim())
  if (jurisdictionOther.value.trim()) jurisdictions.push(jurisdictionOther.value.trim())

  const payload: Array<{ preference_type: string; preference_value: string }> = []
  for (const v of categories) payload.push({ preference_type: 'category', preference_value: v })
  for (const v of regulations) payload.push({ preference_type: 'regulation', preference_value: v })
  for (const v of jurisdictions) payload.push({ preference_type: 'jurisdiction', preference_value: v })
  for (const v of companies) payload.push({ preference_type: 'company', preference_value: v })
  for (const v of industries) payload.push({ preference_type: 'industry', preference_value: v })
  for (const v of freetext) payload.push({ preference_type: 'freetext', preference_value: v })

  try {
    await $fetch('/api/settings/preferences', {
      method: 'PUT',
      body: payload
    })

    if (settings.value) {
      settings.value.preferences = payload
        .map((p) => ({ preference_type: p.preference_type, preference_value: p.preference_value }))
        .slice()
    }
    fillEditorFromPreferences(settings.value?.preferences ?? [])
    prefsSaved.value = true
    setTimeout(() => (prefsSaved.value = false), 2500)
  } catch (e) {
    prefsError.value = getErrorText(e)
  } finally {
    prefsSaving.value = false
  }
}

function channelLabel(type: string): string {
  if (type === 'email') return 'Email'
  if (type === 'discord') return 'Discord'
  if (type === 'telegram') return 'Telegram'
  if (type === 'webhook') return 'Webhook'
  if (type === 'api') return 'API'
  return type || 'Channel'
}

function truncateMiddle(value: string, max = 44): string {
  const s = (value || '').trim()
  if (!s) return '—'
  if (s.length <= max) return s
  const head = Math.max(10, Math.floor(max * 0.6))
  const tail = Math.max(8, max - head - 1)
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function channelDetail(c: SettingsData['channels'][number]): string {
  const cfg = c.channel_config || {}
  if (c.channel_type === 'email') return settings.value?.subscriber.email || '—'
  if (c.channel_type === 'discord') return truncateMiddle(String(cfg.discord_webhook_url || '—'))
  if (c.channel_type === 'telegram') return `Chat ID: ${String(cfg.telegram_chat_id || '—')}`
  if (c.channel_type === 'webhook') return truncateMiddle(String(cfg.webhook_endpoint_url || '—'))
  if (c.channel_type === 'api') return `Key: ${truncateMiddle(String(cfg.api_key || '—'), 32)}`
  return '—'
}

function channelStatusText(c: SettingsData['channels'][number]): string {
  const fails = typeof c.consecutive_failures === 'number' ? c.consecutive_failures : 0
  if (!c.is_active) return 'Inactive'
  if (fails >= 3) return `Failed (${fails})`
  return 'Active'
}

function channelStatusClass(c: SettingsData['channels'][number]): string {
  const fails = typeof c.consecutive_failures === 'number' ? c.consecutive_failures : 0
  if (!c.is_active) return 'border-gray-800 bg-gray-950/40 text-gray-300'
  if (fails >= 3) return 'border-red-900/60 bg-red-950/20 text-red-200'
  return 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'
}

async function removeChannel(id: string) {
  channelAddError.value = null
  if (!confirm('Remove this channel?')) return
  channelRemovingId.value = id
  try {
    await $fetch(`/api/settings/channels/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (settings.value) settings.value.channels = settings.value.channels.filter((c) => c.id !== id)
  } catch (e) {
    channelAddError.value = getErrorText(e)
  } finally {
    channelRemovingId.value = null
  }
}

async function addChannel() {
  channelAddError.value = null
  apiKeyCreated.value = null
  channelAdding.value = true
  try {
    const config: Record<string, unknown> = {}
    if (newChannelType.value === 'discord') config.discord_webhook_url = newDiscordWebhookUrl.value
    if (newChannelType.value === 'telegram') config.telegram_chat_id = newTelegramChatId.value
    if (newChannelType.value === 'webhook') config.webhook_endpoint_url = newWebhookEndpointUrl.value

    const created = await $fetch<SettingsData['channels'][number]>('/api/settings/channels', {
      method: 'POST',
      body: {
        channel_type: newChannelType.value,
        channel_config: config,
        is_active: true
      }
    })

    if (settings.value) settings.value.channels = [created, ...(settings.value.channels ?? [])]
    if (newChannelType.value === 'api') {
      const key = (created.channel_config as Record<string, unknown>)?.api_key
      if (typeof key === 'string' && key) apiKeyCreated.value = key
    }

    // Reset inputs
    newDiscordWebhookUrl.value = ''
    newTelegramChatId.value = ''
    newWebhookEndpointUrl.value = ''
  } catch (e) {
    channelAddError.value = getErrorText(e)
  } finally {
    channelAdding.value = false
  }
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('fail')) return 'border-red-900/60 bg-red-950/20 text-red-200'
  if (s.includes('sent') || s.includes('ok') || s.includes('success')) return 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'
  return 'border-gray-800 bg-gray-950/40 text-gray-300'
}

function safeHref(url: string): string {
  try {
    const u = new URL(url)
    return u.href
  } catch {
    return '#'
  }
}

async function unsubscribeAll() {
  dangerError.value = null
  if (!confirm('Unsubscribe from all notifications? This deletes all channels and clears preferences.')) return
  dangerBusy.value = true
  try {
    await $fetch('/api/settings/unsubscribe', { method: 'POST' })
    await load()
  } catch (e) {
    dangerError.value = getErrorText(e)
  } finally {
    dangerBusy.value = false
  }
}

async function deleteAccount() {
  dangerError.value = null
  if (!confirm('Delete your account permanently? This cannot be undone.')) return
  dangerBusy.value = true
  try {
    await $fetch('/api/settings/delete-account', { method: 'POST' })
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    window.location.href = '/'
  } catch (e) {
    dangerError.value = getErrorText(e)
  } finally {
    dangerBusy.value = false
  }
}

const { data: categoriesData, pending: categoriesPending, error: categoriesError } = await useFetch<{ items: Category[] }>(
  '/api/categories'
)

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
    'ai-security'
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
    'iot-ot',
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
</script>
