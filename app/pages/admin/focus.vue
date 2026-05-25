<template>
  <div class="-m-6 min-h-full bg-[#0e131f] p-6 text-white">
    <!-- Toast -->
    <div
      v-if="toast.open"
      class="fixed right-4 top-4 z-[80] w-[min(420px,calc(100vw-2rem))] rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur"
      :class="toastClass"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-medium">{{ toast.title }}</div>
          <div v-if="toast.message" class="mt-1 text-[#94a3b8]">{{ toast.message }}</div>
        </div>
        <button type="button" class="text-[#94a3b8] hover:text-white" @click="toast.open = false">×</button>
      </div>
    </div>

    <header class="flex flex-col gap-4 border-b border-[#1e293b] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="text-[10px] font-black tracking-[0.35em] text-[#ef4444]/70">ADMIN_FOCUS</div>
        <h1 class="mt-2 text-2xl font-black tracking-tight">Focus Items</h1>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ef4444] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0e131f] shadow-[0_8px_24px_rgba(239,68,68,0.18)] hover:brightness-110"
          @click="openCreate()"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          Create Focus Item
        </button>

        <button
          type="button"
          class="rounded-lg border border-[#1e293b] bg-[#161c28] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 hover:bg-[#1a2231]"
          :disabled="loading"
          @click="refresh"
        >
          Refresh
        </button>
      </div>
    </header>

    <section class="mt-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors"
          :class="t.key === statusTab ? 'bg-[#ef4444] text-[#0e131f]' : 'border border-[#1e293b] text-[#94a3b8] hover:text-white'"
          @click="statusTab = t.key"
        >
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="mt-6">
      <div v-if="loading" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-[#94a3b8]">
        Loading focus items...
      </div>

      <div v-else-if="error" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-6 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-else-if="items.length === 0" class="rounded-xl border border-[#1e293b] bg-[#161c28] p-10 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#0e131f] ring-1 ring-[#1e293b]">
          <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-[#ef4444]" />
        </div>
        <div class="text-base font-bold">No focus items found.</div>
        <div class="mt-1 text-sm text-[#94a3b8]">Try another status filter.</div>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="fi in items"
          :key="fi.id"
          class="rounded-2xl border border-[#1e293b] bg-[#161c28] p-5"
          :class="cardClass(fi)"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" :class="severityBadgeClass(fi.severity)">
                  {{ fi.severity.toUpperCase() }}
                </span>
                <span class="rounded-full border border-[#1e293b] bg-[#161c28] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                  {{ categoryLabel(fi.category) }}
                </span>
                <span class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" :style="statusBadgeStyle(fi.status)">
                  {{ fi.status }}
                </span>
                <span class="font-label text-[10px] uppercase tracking-widest text-[#64748b]">
                  Created {{ fmtDateTime(fi.created_at) }}
                </span>
                <span v-if="fi.expires_at" class="font-label text-[10px] uppercase tracking-widest text-[#64748b]">
                  Expires {{ fmtDateTime(fi.expires_at) }}
                </span>
              </div>

              <div class="mt-3 text-lg font-bold text-white">{{ fi.title }}</div>
              <p class="mt-2 text-sm leading-6 text-[#cbd5e1]">{{ fi.summary }}</p>

              <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94a3b8]">
                <span class="font-mono">slug: {{ fi.slug }}</span>
                <span>Updated {{ fmtDateTime(fi.updated_at) }}</span>
                <span>Article IDs: {{ (fi.article_ids ?? []).length }}</span>
              </div>

              <div
                v-if="fi.action_required && fi.action_required.trim()"
                class="mt-4 rounded-lg border border-red-500/25 bg-[#0e131f] px-4 py-3"
              >
                <div class="flex items-start gap-3">
                  <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-[#ef4444]" />
                  <div class="min-w-0">
                    <div class="text-xs font-bold uppercase tracking-widest text-[#ef4444]">Action required</div>
                    <div class="mt-1 text-sm font-semibold text-white">{{ fi.action_required }}</div>
                  </div>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div class="rounded-xl border border-[#1e293b] bg-[#0e131f] p-4">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">CVE IDs</div>
                  <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <a
                      v-for="cve in (fi.cve_ids ?? []).slice(0, 20)"
                      :key="cve"
                      :href="`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-bold text-[#4cd7f6] hover:underline"
                    >
                      {{ cve }}
                    </a>
                    <span v-if="(fi.cve_ids ?? []).length === 0" class="text-sm text-[#94a3b8]">None</span>
                  </div>
                </div>

                <div class="rounded-xl border border-[#1e293b] bg-[#0e131f] p-4">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Affected products</div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      v-for="p in (fi.affected_products ?? []).slice(0, 20)"
                      :key="p"
                      class="rounded-full border border-[#1e293b] bg-[#0e131f] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94a3b8]"
                    >
                      {{ p }}
                    </span>
                    <span v-if="(fi.affected_products ?? []).length === 0" class="text-sm text-[#94a3b8]">None</span>
                  </div>
                </div>

                <div class="rounded-xl border border-[#1e293b] bg-[#0e131f] p-4 md:col-span-2">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">IOC summary</div>
                  <div class="mt-2 text-sm text-[#cbd5e1]">{{ fi.ioc_summary || 'None' }}</div>
                </div>

                <div class="rounded-xl border border-[#1e293b] bg-[#0e131f] p-4 md:col-span-2">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Source URLs</div>
                  <ul class="mt-2 space-y-1 text-sm">
                    <li v-for="u in (fi.source_urls ?? []).slice(0, 20)" :key="u">
                      <a :href="safeHref(u)" target="_blank" rel="noopener noreferrer" class="text-white/90 hover:text-[#4cd7f6] hover:underline">
                        {{ u }}
                      </a>
                    </li>
                    <li v-if="(fi.source_urls ?? []).length === 0" class="text-sm text-[#94a3b8]">None</li>
                  </ul>
                </div>

                <div class="rounded-xl border border-[#1e293b] bg-[#0e131f] p-4 md:col-span-2">
                  <div class="text-xs font-bold uppercase tracking-widest text-[#64748b]">Linked articles</div>
                  <ul class="mt-2 space-y-1 text-sm">
                    <li v-for="a in (fi.articles ?? []).slice(0, 20)" :key="a.id">
                      <div class="flex flex-wrap items-center gap-2">
                        <NuxtLink :to="`/admin/articles/${a.id}`" class="text-[#4cd7f6] hover:underline">
                          {{ a.title }}
                        </NuxtLink>
                        <a :href="safeHref(a.url)" target="_blank" rel="noopener noreferrer" class="text-xs text-[#94a3b8] hover:text-white hover:underline">
                          Open
                        </a>
                      </div>
                    </li>
                    <li v-if="(fi.articles ?? []).length === 0" class="text-sm text-[#94a3b8]">None</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-2" @click.stop>
              <button
                v-if="fi.status === 'pending'"
                type="button"
                class="rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="busyId === fi.id"
                @click="patchStatus(fi, 'active')"
              >
                Approve
              </button>

              <button
                v-if="fi.status === 'archived'"
                type="button"
                class="rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="busyId === fi.id"
                @click="patchStatus(fi, 'active')"
              >
                Activate
              </button>

              <button
                v-if="fi.status !== 'archived'"
                type="button"
                class="rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-xs font-bold text-[#94a3b8] hover:text-white disabled:opacity-70"
                :disabled="busyId === fi.id"
                @click="patchStatus(fi, 'archived')"
              >
                Archive
              </button>

              <button
                type="button"
                class="rounded-lg border border-red-500/40 bg-transparent px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-70"
                :disabled="busyId === fi.id"
                @click="extend48h(fi)"
              >
                Extend 48h
              </button>

              <button
                type="button"
                class="rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-xs font-bold text-[#94a3b8] hover:text-white"
                @click="toggleEdit(fi)"
              >
                {{ editingId === fi.id ? 'Close' : 'Edit' }}
              </button>
            </div>
          </div>

          <!-- Inline editor -->
          <div v-if="editingId === fi.id" class="mt-5 rounded-xl border border-[#1e293b] bg-[#0e131f] p-4" @click.stop>
            <div v-if="editError" class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {{ editError }}
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Title</label>
                <input
                  v-model.trim="editForm.title"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Summary</label>
                <textarea
                  v-model.trim="editForm.summary"
                  rows="4"
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                />
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Action required</label>
                <input
                  v-model.trim="editForm.action_required"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Severity</label>
                <select
                  v-model="editForm.severity"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Category</label>
                <select
                  v-model="editForm.category"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
                  <option value="cve">cve</option>
                  <option value="breach">breach</option>
                  <option value="exploit">exploit</option>
                  <option value="campaign">campaign</option>
                  <option value="advisory">advisory</option>
                </select>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">CVE IDs (comma-separated)</label>
                <input
                  v-model.trim="editForm.cve_ids"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                  placeholder="CVE-2025-1234, CVE-2025-5678"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Affected products (comma-separated)</label>
                <input
                  v-model.trim="editForm.affected_products"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">IOC summary</label>
                <textarea
                  v-model.trim="editForm.ioc_summary"
                  rows="3"
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                />
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Source URLs (comma-separated)</label>
                <input
                  v-model.trim="editForm.source_urls"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                  placeholder="https://..., https://..."
                >
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2 border-t border-[#1e293b] pt-4">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-bold text-[#94a3b8] hover:text-white"
                :disabled="saving"
                @click="cancelEdit()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ef4444] px-4 py-2 text-sm font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="saving"
                @click="saveEdit(fi)"
              >
                <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Create modal -->
    <Teleport to="body">
      <div
        v-if="createOpen"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="closeCreate()"
      >
        <div class="w-full max-w-2xl overflow-hidden rounded-xl border border-[#1e293b] bg-[#161c28] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div class="flex items-start justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
            <div>
              <div class="text-lg font-extrabold">Create focus item</div>
              <div class="mt-1 text-sm text-[#94a3b8]">Items are created as pending for review.</div>
            </div>
            <button type="button" class="text-[#94a3b8] hover:text-white" aria-label="Close" @click="closeCreate()">
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>

          <form class="space-y-4 px-6 py-5" @submit.prevent="submitCreate">
            <div v-if="createError" class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {{ createError }}
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Title <span class="text-[#ef4444]">*</span></label>
                <input
                  v-model.trim="createForm.title"
                  type="text"
                  required
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Summary <span class="text-[#ef4444]">*</span></label>
                <textarea
                  v-model.trim="createForm.summary"
                  rows="4"
                  required
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Severity</label>
                <select
                  v-model="createForm.severity"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#94a3b8]">Category</label>
                <select
                  v-model="createForm.category"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
                  <option value="cve">cve</option>
                  <option value="breach">breach</option>
                  <option value="exploit">exploit</option>
                  <option value="campaign">campaign</option>
                  <option value="advisory">advisory</option>
                </select>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">CVE IDs (comma-separated)</label>
                <input
                  v-model.trim="createForm.cve_ids"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Affected products (comma-separated)</label>
                <input
                  v-model.trim="createForm.affected_products"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Action required</label>
                <input
                  v-model.trim="createForm.action_required"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">IOC summary (optional)</label>
                <textarea
                  v-model.trim="createForm.ioc_summary"
                  rows="3"
                  class="mt-1 w-full resize-y rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                />
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-[#94a3b8]">Source URLs (comma-separated)</label>
                <input
                  v-model.trim="createForm.source_urls"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#0e131f] px-3 py-2 text-sm text-white outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/25"
                >
              </div>

              <!-- Article picker -->
              <div class="md:col-span-2 rounded-xl border border-[#1e293b] bg-[#0e131f]">
                <button
                  type="button"
                  class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white hover:bg-black/20"
                  @click="pickerOpen = !pickerOpen"
                >
                  <span>Link articles {{ selectedArticles.size > 0 ? `(${selectedArticles.size} selected)` : '' }}</span>
                  <UIcon :name="pickerOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4 text-[#94a3b8]" />
                </button>

                <div v-if="pickerOpen" class="border-t border-[#1e293b] px-4 py-3 space-y-2">
                  <div v-if="loadingArticles" class="text-sm text-[#94a3b8]">Loading articles...</div>
                  <div v-else-if="recentArticles.length === 0" class="text-sm text-[#94a3b8]">No recent articles found.</div>
                  <template v-else>
                    <div class="mb-3 flex items-center justify-between">
                      <span class="text-xs text-[#94a3b8]">Recent approved articles</span>
                      <button
                        v-if="selectedArticles.size > 0"
                        type="button"
                        class="text-xs text-[#94a3b8] hover:text-white"
                        @click="selectedArticles.clear()"
                      >
                        Clear selection
                      </button>
                    </div>
                    <label
                      v-for="a in recentArticles"
                      :key="a.id"
                      class="flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-black/20"
                      :class="selectedArticles.has(a.id) ? 'bg-[#ef4444]/5' : ''"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedArticles.has(a.id)"
                        class="mt-0.5 h-4 w-4 rounded border-[#1e293b] bg-[#0e131f] text-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/40"
                        @change="toggleArticle(a.id)"
                      >
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-white truncate">{{ a.title }}</div>
                        <div class="text-xs text-[#64748b] truncate">{{ a.brief || a.ai_summary?.slice(0, 110) || '' }}</div>
                      </div>
                      <span class="ml-auto shrink-0 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-[#94a3b8]">
                        {{ a.relevance_score }}
                      </span>
                    </label>
                  </template>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-[#1e293b] pt-4">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-bold text-[#94a3b8] hover:text-white"
                :disabled="creating"
                @click="closeCreate()"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ef4444] px-4 py-2 text-sm font-bold text-[#0e131f] hover:brightness-110 disabled:opacity-70"
                :disabled="creating"
              >
                <span v-if="creating" class="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                {{ creating ? 'Creating…' : 'Create focus item' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

definePageMeta({ layout: 'admin' })

type FocusSeverity = 'critical' | 'high' | 'medium'
type FocusCategory = 'cve' | 'breach' | 'exploit' | 'campaign' | 'advisory'
type FocusStatus = 'pending' | 'active' | 'archived'

type FocusItem = {
  id: string
  title: string
  slug: string
  summary: string
  severity: FocusSeverity
  category: FocusCategory
  cve_ids: string[]
  affected_products: string[]
  action_required: string | null
  article_ids: string[]
  articles: Array<{ id: string; title: string; url: string }>
  ioc_summary: string | null
  source_urls: string[]
  status: FocusStatus
  expires_at: string | null
  created_at: string
  updated_at: string
}

const tabs: Array<{ key: FocusStatus | 'all'; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' }
]

const statusTab = ref<FocusStatus | 'all'>('active')
const items = ref<FocusItem[]>([])
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

const apiQuery = computed(() => (statusTab.value === 'all' ? {} : { status: statusTab.value }))
const { data, pending, error: fetchError, refresh } = useFetch<{ items: FocusItem[] }>('/api/admin/focus', {
  query: apiQuery
})

const loading = computed(() => pending.value)

watch(
  data,
  (res) => {
    if (!res) return
    items.value = Array.isArray(res.items) ? res.items : []
  },
  { immediate: true }
)

watch(
  fetchError,
  (e) => {
    error.value = e ? getErrorMessage(e) : null
  },
  { immediate: true }
)

function categoryLabel(c: FocusCategory): string {
  if (c === 'cve') return 'CVE'
  if (c === 'breach') return 'BREACH'
  if (c === 'exploit') return 'EXPLOIT'
  if (c === 'campaign') return 'CAMPAIGN'
  return 'ADVISORY'
}

function severityBadgeClass(s: FocusSeverity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (s === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/25'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
}

function cardClass(item: FocusItem): string {
  if (item.severity === 'critical') return 'border-l-4 border-l-[#ef4444]'
  if (item.severity === 'high') return 'border-l-4 border-l-[#f97316]'
  return 'border-l-4 border-l-[#eab308]'
}

function statusBadgeStyle(status: FocusStatus) {
  const c = status === 'active' ? '#22c55e' : status === 'pending' ? '#eab308' : '#64748b'
  return { backgroundColor: `${c}22`, border: `1px solid ${c}55`, color: c }
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'N/A'
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${date} at ${time}`
  } catch {
    return 'N/A'
  }
}

async function patchStatus(fi: FocusItem, status: FocusStatus) {
  if (busyId.value) return
  busyId.value = fi.id
  try {
    await $fetch(`/api/admin/focus/${encodeURIComponent(fi.id)}`, { method: 'PATCH', body: { status } })
    showToast('success', 'Updated', `Focus item set to ${status}.`)
    await refresh()
  } catch (e: unknown) {
    showToast('error', 'Could not update', getErrorMessage(e))
  } finally {
    busyId.value = null
  }
}

async function extend48h(fi: FocusItem) {
  if (busyId.value) return
  busyId.value = fi.id
  try {
    const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    await $fetch(`/api/admin/focus/${encodeURIComponent(fi.id)}`, { method: 'PATCH', body: { expires_at } })
    showToast('success', 'Extended', 'Expiry updated by 48 hours.')
    await refresh()
  } catch (e: unknown) {
    showToast('error', 'Could not extend', getErrorMessage(e))
  } finally {
    busyId.value = null
  }
}

// Inline edit
const editingId = ref<string | null>(null)
const saving = ref(false)
const editError = ref<string | null>(null)

const editForm = reactive<{
  title: string
  summary: string
  action_required: string
  severity: FocusSeverity
  category: FocusCategory
  cve_ids: string
  affected_products: string
  ioc_summary: string
  source_urls: string
}>(
  {
    title: '',
    summary: '',
    action_required: '',
    severity: 'critical',
    category: 'cve',
    cve_ids: '',
    affected_products: '',
    ioc_summary: '',
    source_urls: ''
  }
)

function toggleEdit(fi: FocusItem) {
  if (editingId.value === fi.id) {
    cancelEdit()
    return
  }
  editingId.value = fi.id
  editError.value = null
  editForm.title = fi.title
  editForm.summary = fi.summary
  editForm.action_required = fi.action_required ?? ''
  editForm.severity = fi.severity
  editForm.category = fi.category
  editForm.cve_ids = (fi.cve_ids ?? []).join(', ')
  editForm.affected_products = (fi.affected_products ?? []).join(', ')
  editForm.ioc_summary = fi.ioc_summary ?? ''
  editForm.source_urls = (fi.source_urls ?? []).join(', ')
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

function splitCsv(v: string): string[] {
  return String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function saveEdit(fi: FocusItem) {
  if (saving.value) return
  editError.value = null
  saving.value = true
  try {
    if (!editForm.title.trim()) throw new Error('Title is required')
    if (!editForm.summary.trim()) throw new Error('Summary is required')

    const payload = {
      title: editForm.title.trim(),
      summary: editForm.summary.trim(),
      action_required: editForm.action_required.trim() || null,
      severity: editForm.severity,
      category: editForm.category,
      cve_ids: splitCsv(editForm.cve_ids),
      affected_products: splitCsv(editForm.affected_products),
      ioc_summary: editForm.ioc_summary.trim() || null,
      source_urls: splitCsv(editForm.source_urls)
    }

    await $fetch(`/api/admin/focus/${encodeURIComponent(fi.id)}`, { method: 'PATCH', body: payload })
    showToast('success', 'Saved', 'Focus item updated.')
    editingId.value = null
    await refresh()
  } catch (e: unknown) {
    editError.value = getErrorMessage(e)
  } finally {
    saving.value = false
  }
}

// Create modal
const createOpen = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)

const createForm = reactive<{
  title: string
  summary: string
  severity: FocusSeverity
  category: FocusCategory
  cve_ids: string
  affected_products: string
  action_required: string
  ioc_summary: string
  source_urls: string
}>(
  {
    title: '',
    summary: '',
    severity: 'critical',
    category: 'cve',
    cve_ids: '',
    affected_products: '',
    action_required: '',
    ioc_summary: '',
    source_urls: ''
  }
)

const pickerOpen = ref(false)
const selectedArticles = reactive(new Set<string>())
const recentArticles = ref<Array<{ id: string; title: string; brief: string | null; ai_summary: string | null; relevance_score: number }>>([])
const loadingArticles = ref(false)

function toggleArticle(id: string) {
  if (selectedArticles.has(id)) selectedArticles.delete(id)
  else selectedArticles.add(id)
}

watch(
  () => createOpen.value,
  async (open) => {
    if (!open) return
    if (recentArticles.value.length > 0) return
    loadingArticles.value = true
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const res = await $fetch<{ data?: Array<Record<string, unknown>> }>('/api/admin/social/articles', {
        query: { since: cutoff }
      })
      const raw = (Array.isArray(res) ? (res as unknown as Array<Record<string, unknown>>) : res?.data) ?? []
      recentArticles.value = raw.map((a: Record<string, unknown>) => ({
        id: String(a.id || ''),
        title: String(a.title || ''),
        brief: typeof a.brief === 'string' ? a.brief : null,
        ai_summary: typeof a.ai_summary === 'string' ? a.ai_summary : null,
        relevance_score: Number(a.relevance_score ?? 0)
      })).filter((a) => a.id)
    } catch {
      recentArticles.value = []
    } finally {
      loadingArticles.value = false
    }
  }
)

function openCreate() {
  createOpen.value = true
  createError.value = null
}

function closeCreate() {
  createOpen.value = false
  createError.value = null
  pickerOpen.value = false
}

function resetCreateForm() {
  createForm.title = ''
  createForm.summary = ''
  createForm.severity = 'critical'
  createForm.category = 'cve'
  createForm.cve_ids = ''
  createForm.affected_products = ''
  createForm.action_required = ''
  createForm.ioc_summary = ''
  createForm.source_urls = ''
  selectedArticles.clear()
}

async function submitCreate() {
  if (creating.value) return
  createError.value = null
  creating.value = true
  try {
    if (!createForm.title.trim()) throw new Error('Title is required')
    if (!createForm.summary.trim()) throw new Error('Summary is required')

    const payload = {
      title: createForm.title.trim(),
      summary: createForm.summary.trim(),
      severity: createForm.severity,
      category: createForm.category,
      cve_ids: splitCsv(createForm.cve_ids),
      affected_products: splitCsv(createForm.affected_products),
      action_required: createForm.action_required.trim() || null,
      ioc_summary: createForm.ioc_summary.trim() || null,
      source_urls: splitCsv(createForm.source_urls),
      article_ids: [...selectedArticles],
      status: 'pending' as const
    }

    await $fetch('/api/admin/focus', { method: 'POST', body: payload })
    showToast('success', 'Created', 'Focus item created as pending.')
    closeCreate()
    resetCreateForm()
    statusTab.value = 'pending'
    await refresh()
  } catch (e: unknown) {
    createError.value = getErrorMessage(e)
  } finally {
    creating.value = false
  }
}

// Toast
const toast = reactive<{ open: boolean; title: string; message: string; kind: 'success' | 'error' | 'info' }>({
  open: false,
  title: '',
  message: '',
  kind: 'info'
})

const toastClass = computed(() => {
  const base = 'bg-[#161c28]/90 border-[#1e293b]'
  if (toast.kind === 'success') return `${base} ring-1 ring-[#22c55e]/20`
  if (toast.kind === 'error') return `${base} ring-1 ring-red-500/20`
  return `${base} ring-1 ring-[#ef4444]/15`
})

function showToast(kind: typeof toast.kind, title: string, message = '') {
  toast.kind = kind
  toast.title = title
  toast.message = message
  toast.open = true
  setTimeout(() => {
    toast.open = false
  }, 3200)
}

function getErrorMessage(e: unknown): string {
  const anyE = e as Record<string, unknown>
  const msg = (anyE?.data as Record<string, unknown> | undefined)?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  if (typeof anyE?.statusMessage === 'string' && anyE.statusMessage.trim()) return anyE.statusMessage
  if (typeof anyE?.message === 'string' && anyE.message.trim()) return anyE.message
  return 'Something went wrong.'
}
</script>
