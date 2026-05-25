<template>
  <div class="relative -m-6 p-6">
    <!-- Tactical grid background (subtle) -->
    <div
      class="pointer-events-none absolute inset-0 opacity-40"
      style="background-image: radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.06) 1px, transparent 0); background-size: 24px 24px;"
    />

    <div class="relative space-y-6">
      <!-- Header -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/80">
            <UIcon name="i-heroicons-sparkles" class="h-4 w-4" />
            Tips &amp; Tricks
          </div>
          <h1 class="text-3xl font-extrabold tracking-tight text-gray-50 md:text-4xl">
            Intel <span class="text-cyan-300">Repository</span>
          </h1>
          <p class="max-w-2xl text-sm text-gray-300">
            Manage published tips, draft intel, and the user submission queue.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- View switch -->
          <div class="flex items-center rounded-full border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors"
              :class="mode === 'manager' ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="mode = 'manager'"
            >
              Manager
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors"
              :class="mode === 'submissions' ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="mode = 'submissions'"
            >
              Submissions
            </button>
          </div>

          <button
            v-if="mode === 'manager'"
            type="button"
            class="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 px-5 py-2.5 text-sm font-extrabold uppercase tracking-widest text-black shadow-lg shadow-cyan-500/10 transition-transform active:scale-95"
            @click="openAddTip"
          >
            <UIcon name="i-heroicons-plus" class="h-4 w-4" />
            Add new tip
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:bg-black/40"
            :disabled="mode === 'manager' ? tipsPending : submissionsPending"
            @click="mode === 'manager' ? refreshTips() : refreshSubmissions()"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <!-- Manager -->
      <section v-if="mode === 'manager'" class="space-y-6">
        <!-- Stats -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div class="glass-panel md:col-span-3">
            <div class="p-5">
              <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Total tips</div>
              <div class="mt-3 flex items-end justify-between">
                <div class="text-4xl font-extrabold tracking-tight text-gray-50">{{ tipStats.total }}</div>
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400">COUNT</div>
              </div>
            </div>
          </div>
          <div class="glass-panel md:col-span-3">
            <div class="p-5">
              <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Published</div>
              <div class="mt-3 flex items-end justify-between">
                <div class="text-4xl font-extrabold tracking-tight text-cyan-200">{{ tipStats.published }}</div>
                <div class="text-[10px] font-mono uppercase tracking-widest text-cyan-300/80">LIVE</div>
              </div>
            </div>
          </div>
          <div class="glass-panel md:col-span-6">
            <div class="p-5">
              <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Drafts</div>
              <div class="mt-3 flex items-end justify-between">
                <div class="text-4xl font-extrabold tracking-tight text-gray-100">{{ tipStats.draft }}</div>
                <div class="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-400">
                  <span class="h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
                  Terminal secure
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status pills -->
        <div class="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
              :class="tipStatus === 'all' ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="tipStatus = 'all'"
            >
              All
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
              :class="tipStatus === 'published' ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="tipStatus = 'published'"
            >
              Published
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
              :class="tipStatus === 'draft' ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="tipStatus = 'draft'"
            >
              Draft
            </button>
          </div>

          <div class="text-xs text-gray-400">
            Showing <span class="font-mono text-gray-200">{{ filteredTips.length }}</span> entries
          </div>
        </div>

        <!-- Data grid -->
        <div class="glass-panel overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr class="border-b border-white/10 bg-black/20">
                  <th class="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Title</th>
                  <th class="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Category</th>
                  <th class="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Status</th>
                  <th class="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Date</th>
                  <th class="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Actions</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-white/5">
                <tr v-if="tipsPending">
                  <td colspan="5" class="px-6 py-6 text-sm text-gray-300">Loading…</td>
                </tr>

                <tr
                  v-for="t in filteredTips"
                  :key="t.id"
                  class="group transition-colors hover:bg-cyan-500/5"
                >
                  <td class="px-6 py-5">
                    <div class="flex items-start gap-3">
                      <UIcon name="i-heroicons-document-text" class="mt-0.5 h-5 w-5 text-cyan-300/80" />
                      <div class="min-w-0">
                        <div class="truncate text-sm font-semibold text-gray-50">{{ t.title }}</div>
                        <div class="truncate font-mono text-[10px] uppercase tracking-tight text-gray-500">UUID: {{ t.id }}</div>
                      </div>
                      <span
                        v-if="t.featured"
                        class="ml-auto inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200"
                      >
                        <UIcon name="i-heroicons-star-solid" class="h-3 w-3" />
                        Featured
                      </span>
                    </div>
                  </td>

                  <td class="px-6 py-5">
                    <span
                      class="inline-flex items-center rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                      :class="t.category?.name ? 'bg-white/5 text-gray-200 ring-1 ring-white/10' : 'bg-white/5 text-gray-400 ring-1 ring-white/10'"
                    >
                      {{ t.category?.name || 'Uncategorized' }}
                    </span>
                  </td>

                  <td class="px-6 py-5">
                    <div class="flex justify-center">
                      <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest" :class="tipBadgeClass(t.status)">
                        <span class="h-1.5 w-1.5 rounded-full" :class="tipDotClass(t.status)" />
                        {{ t.status }}
                      </span>
                    </div>
                  </td>

                  <td class="px-6 py-5 text-right">
                    <span class="font-mono text-[11px] text-gray-300">{{ fmtDate(t.created_at) }}</span>
                  </td>

                  <td class="px-6 py-5 text-right" @click.stop>
                    <div class="inline-flex items-center justify-end gap-3">
                      <NuxtLink
                        :to="`/tips/${t.id}`"
                        class="text-gray-400 transition-colors hover:text-cyan-200"
                        title="View"
                      >
                        <UIcon name="i-heroicons-eye" class="h-5 w-5" />
                      </NuxtLink>
                      <button
                        type="button"
                        class="text-gray-400 transition-colors hover:text-cyan-200"
                        title="Edit"
                        @click="openEditTip(t)"
                      >
                        <UIcon name="i-heroicons-pencil-square" class="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        class="text-gray-400 transition-colors hover:text-red-300"
                        title="Delete"
                        @click="deleteTip(t)"
                      >
                        <UIcon name="i-heroicons-trash" class="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>

                <tr v-if="!tipsPending && !filteredTips.length">
                  <td colspan="5" class="px-6 py-10 text-sm text-gray-300">
                    No tips found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Submissions (preserves existing moderation workflows) -->
      <section v-else class="space-y-6">
        <div class="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="opt in submissionStatusOptions"
              :key="opt.value"
              type="button"
              class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
              :class="submissionFilters.status === opt.value ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-300 hover:text-gray-100'"
              @click="submissionFilters.status = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="text-xs text-gray-400">
            {{ submissionFilters.statusLabel }}:
            <span class="font-mono text-gray-200">{{ submissionsData?.total ?? 0 }}</span>
          </div>
        </div>

        <div class="glass-panel overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr class="border-b border-white/10 bg-black/20">
                  <th class="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Title</th>
                  <th class="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Category</th>
                  <th class="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">From</th>
                  <th class="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Status</th>
                  <th class="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr v-if="submissionsPending">
                  <td colspan="5" class="px-6 py-6 text-sm text-gray-300">Loading…</td>
                </tr>
                <tr v-for="s in submissions" :key="s.id" class="group transition-colors hover:bg-cyan-500/5">
                  <td class="px-6 py-5">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold text-gray-50">{{ s.title }}</div>
                      <div class="mt-1 font-mono text-[10px] uppercase tracking-tight text-gray-500">{{ fmtDate(s.created_at) }}</div>
                      <button
                        type="button"
                        class="mt-2 inline-flex items-center gap-2 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-200 hover:bg-black/40"
                        @click="toggleExpanded(s.id)"
	                      >
	                        <UIcon :name="expandedId === s.id ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4" />
                        {{ expandedId === s.id ? 'Collapse' : 'Expand' }}
                      </button>
                      <div v-if="expandedId === s.id" class="mt-3 whitespace-pre-wrap text-sm text-gray-200">
                        {{ s.body }}
                      </div>
                      <div v-else class="mt-3 line-clamp-2 whitespace-pre-wrap text-sm text-gray-300">
                        {{ preview(s.body) }}
                      </div>
                      <div v-if="s.reviewer_notes" class="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                        <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Reviewer notes</div>
                        <div class="mt-1 whitespace-pre-wrap">{{ s.reviewer_notes }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-5">
                    <span class="inline-flex items-center rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-200 ring-1 ring-white/10">
                      {{ s.suggested_category || '—' }}
                    </span>
                  </td>
                  <td class="px-6 py-5">
                    <div class="text-xs text-gray-200">{{ s.submitter_name }}</div>
                    <div v-if="s.submitter_email" class="mt-1 font-mono text-[10px] text-gray-400">{{ s.submitter_email }}</div>
                  </td>
                  <td class="px-6 py-5">
                    <div class="flex justify-center">
                      <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest" :class="submissionBadgeClass(s.status)">
                        <span class="h-1.5 w-1.5 rounded-full" :class="submissionDotClass(s.status)" />
                        {{ s.status }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-5 text-right" @click.stop>
                    <div class="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        class="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200 ring-1 ring-cyan-500/20 transition-colors hover:bg-cyan-500/15 disabled:opacity-50"
                        :disabled="s.status !== 'pending'"
                        :aria-disabled="s.status !== 'pending'"
                        @click="approve(s.id)"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        class="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-200 ring-1 ring-red-500/20 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                        :disabled="s.status !== 'pending'"
                        :aria-disabled="s.status !== 'pending'"
                        @click="openReject(s)"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        class="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                        @click="del(s.id)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!submissionsPending && !submissions.length">
                  <td colspan="5" class="px-6 py-10 text-sm text-gray-300">No submissions.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Tactical Intel Editor Modal (Teleport) -->
      <Teleport to="body">
        <div
          v-if="tipEditorOpen"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeTipEditor"
        >
          <div
            class="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-[rgba(8,14,26,0.92)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl"
            style="max-height: 92vh;"
          >
            <!-- Header -->
            <div class="flex items-start justify-between gap-6 border-b border-white/10 bg-black/20 px-8 py-6">
              <div>
                <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
                  TACTICAL_INTEL_EDITOR
                </div>
                <div class="mt-2 flex items-center gap-3">
                  <h2 class="text-lg font-extrabold uppercase tracking-tight text-white">
                    {{ tipEditMode === 'add' ? 'Create tip' : 'Edit tip' }}
                  </h2>
                  <span class="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                    <span class="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
                    Secure
                  </span>
                  <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-200">v1</span>
                </div>
              </div>

              <button type="button" class="text-gray-400 transition-colors hover:text-white" @click="closeTipEditor">
                <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="grid grid-cols-1 gap-8 overflow-auto px-8 py-7 lg:grid-cols-12">
              <!-- Left: content -->
              <div class="space-y-7 lg:col-span-8">
                <div class="space-y-2">
                  <label class="ml-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Title</label>
                  <input
                    v-model.trim="tipForm.title"
                    type="text"
                    placeholder="e.g., Safe KQL generation patterns"
                    class="w-full bg-transparent px-1 py-3 text-xl font-semibold text-white outline-none transition-colors placeholder:text-gray-600 border-b-2 border-white/10 focus:border-cyan-400"
	                  >
                </div>

                <div class="space-y-2">
                  <label class="ml-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Body (Markdown)</label>
	                  <div class="overflow-hidden rounded-lg border border-white/10 bg-black/20">
	                    <textarea
	                      v-model.trim="tipForm.body"
	                      rows="14"
	                      placeholder="Write tactical guidance…"
	                      class="w-full resize-y bg-transparent p-4 text-sm leading-relaxed text-gray-200 outline-none placeholder:text-gray-600"
	                    />
	                  </div>
                </div>
              </div>

              <!-- Right: metadata -->
              <div class="space-y-6 lg:col-span-4">
                <div class="glass-panel p-5">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-adjustments-horizontal" class="h-4 w-4 text-cyan-300/80" />
                    <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300">Metadata</div>
                  </div>

                  <div class="mt-5 grid grid-cols-1 gap-5">
                    <div class="space-y-2">
                      <label class="ml-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Category</label>
                      <select
                        v-model="tipForm.category_id"
                        class="w-full bg-transparent px-1 py-2 text-sm text-gray-200 outline-none border-b-2 border-white/10 focus:border-cyan-400"
                      >
                        <option value="">Uncategorized</option>
                        <option v-for="c in tipCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                      </select>
                    </div>

                    <div class="space-y-2">
                      <label class="ml-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Author</label>
                      <input
                        v-model.trim="tipForm.author_name"
                        type="text"
                        placeholder="ThreatNoir"
                        class="w-full bg-transparent px-1 py-2 text-sm text-gray-200 outline-none border-b-2 border-white/10 focus:border-cyan-400 placeholder:text-gray-600"
	                      >
                    </div>

                    <div class="space-y-2">
                      <label class="ml-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Tags (comma-separated)</label>
                      <input
                        v-model.trim="tipForm.tagsText"
                        type="text"
                        placeholder="triage, soc, llm"
                        class="w-full bg-transparent px-1 py-2 text-sm text-gray-200 outline-none border-b-2 border-white/10 focus:border-cyan-400 placeholder:text-gray-600"
	                      >
                    </div>

                    <button
                      type="button"
                      class="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-4 text-left transition-colors hover:bg-black/30"
                      @click="tipForm.featured = !tipForm.featured"
                    >
                      <div>
                        <div class="text-xs font-extrabold uppercase tracking-widest text-white">Featured</div>
                        <div class="mt-1 text-[10px] uppercase tracking-[0.22em] text-gray-500">Priority placement</div>
                      </div>
                      <div class="relative h-5 w-10 rounded-full transition-colors" :class="tipForm.featured ? 'bg-cyan-500' : 'bg-gray-700'">
                        <div class="absolute top-1 h-3 w-3 rounded-full bg-white transition-all" :class="tipForm.featured ? 'left-6' : 'left-1'" />
                      </div>
                    </button>

                    <button
                      type="button"
                      class="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-4 text-left transition-colors hover:bg-black/30"
                      @click="tipForm.status = tipForm.status === 'published' ? 'draft' : 'published'"
                    >
                      <div>
                        <div class="text-xs font-extrabold uppercase tracking-widest text-white">Published</div>
                        <div class="mt-1 text-[10px] uppercase tracking-[0.22em] text-gray-500">Visibility on /tips</div>
                      </div>
                      <div class="relative h-5 w-10 rounded-full transition-colors" :class="tipForm.status === 'published' ? 'bg-cyan-500' : 'bg-gray-700'">
                        <div class="absolute top-1 h-3 w-3 rounded-full bg-white transition-all" :class="tipForm.status === 'published' ? 'left-6' : 'left-1'" />
                      </div>
                    </button>

                    <div v-if="tipFormError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                      {{ tipFormError }}
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border-l-2 border-cyan-400/30 bg-black/20 p-4">
                  <div class="flex items-center gap-3">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                    <span class="font-mono text-[10px] uppercase tracking-widest text-cyan-200">System Status: Ready</span>
                  </div>
                  <div class="mt-2 font-mono text-[10px] leading-snug text-gray-400">
	                    AUTO_SAVE: DISABLED<br>
                    LATENCY: 14MS
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Bar -->
            <div class="flex items-center justify-between border-t border-white/10 bg-black/20 px-8 py-5">
              <button
                type="button"
                class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors hover:text-white"
                @click="closeTipEditor"
              >
                Discard
              </button>

              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 px-8 py-2.5 text-sm font-extrabold uppercase tracking-widest text-black shadow-lg shadow-cyan-500/10 transition-transform active:scale-95 disabled:opacity-60"
                :disabled="tipSaving"
                @click="saveTip"
              >
                Initiate
                <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Reject modal (submissions) -->
      <UModal v-model="rejectOpen">
        <template #content>
          <div class="p-6">
            <div class="text-lg font-semibold">Reject submission</div>
            <div class="mt-1 text-sm text-gray-300">
              Optionally leave notes for why the tip was rejected.
            </div>

            <div class="mt-4 space-y-2">
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</label>
              <UTextarea v-model.trim="rejectNotes" :rows="6" :maxlength="5000" placeholder="Optional" />
            </div>

            <div class="mt-6 flex items-center justify-end gap-2 border-t border-gray-800 pt-4">
              <UButton color="gray" variant="soft" @click="rejectOpen = false">Cancel</UButton>
              <UButton color="red" :loading="rejectSaving" @click="confirmReject">Reject</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

	// --- Tips Manager (published/draft tips) ---
	type TipCategory = {
	  id: string
	  name: string
	  slug: string
	  color: string | null
	}

	type TipRow = {
	  id: string
	  title: string
	  body: string
	  category_id: string | null
	  tags: string[]
	  author_name: string
	  status: 'draft' | 'published'
	  featured: boolean
	  created_at: string
	  updated_at: string
	  category: TipCategory | null
	}

	type TipsResponse = { items: TipRow[] }
	type TipResponse = { tip: TipRow }
	type DeletedResponse = { deleted: boolean }

	const mode = ref<'manager' | 'submissions'>('manager')
	const tipStatus = ref<'all' | 'draft' | 'published'>('all')

	const { data: tipsData, pending: tipsPending, refresh: refreshTips } = await useFetch<TipsResponse>('/api/admin/tips')
	const tips = computed(() => tipsData.value?.items ?? [])
	const filteredTips = computed(() => {
	  if (tipStatus.value === 'all') return tips.value
	  return tips.value.filter((t) => t.status === tipStatus.value)
	})

	const tipStats = computed(() => {
	  const total = tips.value.length
	  const published = tips.value.filter((t) => t.status === 'published').length
	  const draft = tips.value.filter((t) => t.status === 'draft').length
	  return { total, published, draft }
	})

	const { data: tipCategoriesData } = await useFetch<{ items: TipCategory[] }>('/api/tips/categories')
	const tipCategories = computed(() => tipCategoriesData.value?.items ?? [])

	const tipEditorOpen = ref(false)
	const tipEditMode = ref<'add' | 'edit'>('add')
	const tipEditingId = ref<string | null>(null)
	const tipSaving = ref(false)
	const tipFormError = ref<string | null>(null)

	const tipForm = reactive<{
	  title: string
	  body: string
	  category_id: string
	  tagsText: string
	  author_name: string
	  status: 'draft' | 'published'
	  featured: boolean
	}>(
	  {
	    title: '',
	    body: '',
	    category_id: '',
	    tagsText: '',
	    author_name: 'ThreatNoir',
	    status: 'draft',
	    featured: false
	  }
	)

	function tagsToText(tags: unknown): string {
	  if (!Array.isArray(tags)) return ''
	  return tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 50).join(', ')
	}

	function parseTags(text: string): string[] {
	  return String(text || '')
	    .split(',')
	    .map((t) => t.trim())
	    .filter(Boolean)
	    .slice(0, 50)
	}

	function openAddTip() {
	  tipEditMode.value = 'add'
	  tipEditingId.value = null
	  tipForm.title = ''
	  tipForm.body = ''
	  tipForm.category_id = ''
	  tipForm.tagsText = ''
	  tipForm.author_name = 'ThreatNoir'
	  tipForm.status = 'draft'
	  tipForm.featured = false
	  tipFormError.value = null
	  tipEditorOpen.value = true
	}

	function openEditTip(t: TipRow) {
	  tipEditMode.value = 'edit'
	  tipEditingId.value = t.id
	  tipForm.title = t.title
	  tipForm.body = t.body
	  tipForm.category_id = t.category_id || ''
	  tipForm.tagsText = tagsToText(t.tags)
	  tipForm.author_name = t.author_name
	  tipForm.status = t.status
	  tipForm.featured = Boolean(t.featured)
	  tipFormError.value = null
	  tipEditorOpen.value = true
	}

	function closeTipEditor() {
	  tipEditorOpen.value = false
	  tipFormError.value = null
	}

	function getErrorMessage(e: unknown) {
	  if (e && typeof e === 'object') {
	    const obj = e as Record<string, unknown>
	    const data = obj.data
	    if (data && typeof data === 'object') {
	      const statusMessage = (data as Record<string, unknown>).statusMessage
	      if (typeof statusMessage === 'string' && statusMessage) return statusMessage
	    }
	  }
	  return e instanceof Error ? e.message : 'Internal error'
	}

	async function saveTip() {
	  tipSaving.value = true
	  tipFormError.value = null
	  try {
	    const payload = {
	      title: tipForm.title.trim(),
	      body: tipForm.body.trim(),
	      category_id: tipForm.category_id.trim() || null,
	      tags: parseTags(tipForm.tagsText),
	      author_name: tipForm.author_name.trim(),
	      status: tipForm.status,
	      featured: tipForm.featured
	    }

	    if (tipEditMode.value === 'add') {
	      await $fetch<TipResponse>('/api/admin/tips', { method: 'POST', body: payload })
	    } else {
	      const id = tipEditingId.value
	      if (!id) throw new Error('Missing tip id')
	      await $fetch<TipResponse>(`/api/admin/tips/${id}`, { method: 'PATCH', body: payload })
	    }

	    tipEditorOpen.value = false
	    await refreshTips()
	  } catch (e) {
	    tipFormError.value = getErrorMessage(e)
	  } finally {
	    tipSaving.value = false
	  }
	}

	async function deleteTip(t: TipRow) {
	  const ok = confirm('Delete this tip? This cannot be undone.')
	  if (!ok) return
	  try {
	    await $fetch<DeletedResponse>(`/api/admin/tips/${t.id}`, { method: 'DELETE' })
	    await refreshTips()
	  } catch (e) {
	    alert(getErrorMessage(e))
	  }
	}

	function tipBadgeClass(status: TipRow['status']) {
	  return status === 'published'
	    ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20'
	    : 'bg-white/5 text-gray-200 ring-1 ring-white/10'
	}

	function tipDotClass(status: TipRow['status']) {
	  return status === 'published' ? 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]' : 'bg-gray-400'
	}

	// --- Submissions moderation (existing data fetching + API calls) ---

	type SubmissionRow = {
  id: string
  title: string
  body: string
  suggested_category: string | null
  submitter_name: string
  submitter_email: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
}

type SubmissionsResponse = {
  page: number
  pageSize: number
  total: number
  submissions: SubmissionRow[]
}

type PatchResponse = { ok: boolean; status: 'approved' | 'rejected'; tipId?: string }
type DeleteResponse = { ok: boolean }

	const submissionStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' }
]

	const submissionFilters = reactive<{ status: 'pending' | 'approved' | 'rejected'; statusLabel: string }>({
  status: 'pending',
  statusLabel: 'Pending'
})

	watch(
	  () => submissionFilters.status,
  (v) => {
	    submissionFilters.statusLabel = v === 'approved' ? 'Approved' : v === 'rejected' ? 'Rejected' : 'Pending'
  },
  { immediate: true }
)

	const submissionQuery = computed(() => ({ status: submissionFilters.status, page: 1, pageSize: 100 }))
	const {
	  data: submissionsData,
	  pending: submissionsPending,
	  refresh: refreshSubmissions
	} = await useFetch<SubmissionsResponse>('/api/admin/tips/submissions', { query: submissionQuery })

	const submissions = computed(() => submissionsData.value?.submissions ?? [])

const expandedId = ref<string | null>(null)
function toggleExpanded(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

	function fmtDate(d: string) {
	  try {
	    return new Date(d).toLocaleString()
	  } catch {
	    return d
	  }
	}

	function preview(body: string) {
	  const s = (body || '').trim()
	  if (s.length <= 220) return s
	  return s.slice(0, 220) + '…'
	}

	function submissionBadgeClass(status: SubmissionRow['status']) {
	  if (status === 'approved') return 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20'
	  if (status === 'rejected') return 'bg-red-500/10 text-red-200 ring-1 ring-red-500/20'
	  return 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
	}

	function submissionDotClass(status: SubmissionRow['status']) {
	  if (status === 'approved') return 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
	  if (status === 'rejected') return 'bg-red-300 shadow-[0_0_10px_rgba(248,113,113,0.45)]'
	  return 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
	}

const actionId = ref<string | null>(null)
const actionType = ref<'approve' | 'reject' | 'delete' | null>(null)

async function approve(id: string) {
  actionId.value = id
  actionType.value = 'approve'
  try {
    const res = await $fetch<PatchResponse>(`/api/admin/tips/submissions/${id}`, {
      method: 'PATCH',
      body: { status: 'approved' }
    })
	    await refreshSubmissions()
    if (res?.tipId) {
      // Tips detail is public; keep admin context by staying on this page.
    }
  } finally {
    actionId.value = null
    actionType.value = null
  }
}

const rejectOpen = ref(false)
const rejectSaving = ref(false)
const rejectId = ref<string | null>(null)
const rejectNotes = ref('')

function openReject(s: SubmissionRow) {
  rejectId.value = s.id
  rejectNotes.value = ''
  rejectOpen.value = true
}

async function confirmReject() {
  if (!rejectId.value) return
  rejectSaving.value = true
  actionId.value = rejectId.value
  actionType.value = 'reject'
  try {
    await $fetch<PatchResponse>(`/api/admin/tips/submissions/${rejectId.value}`, {
      method: 'PATCH',
      body: { status: 'rejected', reviewer_notes: rejectNotes.value.trim() || null }
    })
    rejectOpen.value = false
	    await refreshSubmissions()
  } finally {
    rejectSaving.value = false
    actionId.value = null
    actionType.value = null
    rejectId.value = null
    rejectNotes.value = ''
  }
}

async function del(id: string) {
  const ok = confirm('Delete this submission? This cannot be undone.')
  if (!ok) return

  actionId.value = id
  actionType.value = 'delete'
  try {
    await $fetch<DeleteResponse>(`/api/admin/tips/submissions/${id}`, { method: 'DELETE' })
	    await refreshSubmissions()
  } finally {
    actionId.value = null
    actionType.value = null
  }
}

</script>

<style scoped>
.glass-panel {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
  backdrop-filter: blur(18px);
}
</style>
