<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <header class="mb-10 md:mb-14">
        <div class="flex items-center gap-3">
          <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
          <NuxtLink
            to="/tips"
            class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary hover:underline hover:decoration-white/20 hover:underline-offset-4"
          >
            Tips &amp; Tricks
          </NuxtLink>
        </div>

        <h1 class="mt-4 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
          Suggest a Tip
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	          Got a high-signal tactic? Submit it here. If it’s approved, we’ll publish it in Tips &amp; Tricks.
        </p>
      </header>

      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 class="font-headline text-lg font-black tracking-tight text-tn-on-surface md:text-xl">Submission form</h2>
            <p class="mt-1 text-sm text-tn-on-surface-variant">Markdown is supported in the tip body.</p>
          </div>
          <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">No login required</div>
        </div>

        <form class="mt-6 space-y-5" @submit.prevent="onSubmit">
          <UAlert v-if="success" color="primary" variant="soft" title="Submitted">
            {{ successMessage }}
          </UAlert>

          <UAlert v-if="errorMessage" color="red" variant="soft" title="Could not submit">
            {{ errorMessage }}
          </UAlert>

          <div class="space-y-2">
            <label for="tip-title" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
              Title
            </label>
            <UInput
              id="tip-title"
              v-model.trim="form.title"
              type="text"
              placeholder="e.g. Turn noisy alerts into a 5-minute decision"
              color="neutral"
              variant="subtle"
              class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
              :disabled="submitting"
            />
            <p v-if="errors.title" class="text-xs text-red-200">{{ errors.title }}</p>
          </div>

          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div class="space-y-2">
              <label
                for="tip-category"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Category
              </label>
              <USelect
                v-model="form.category"
                :items="categoryOptions"
                size="md"
                class="w-full"
                :disabled="submitting"
              />
              <p class="text-xs text-tn-on-surface-variant">Pick an existing category, or suggest a new one.</p>
            </div>

            <div v-if="form.category === '__new__'" class="space-y-2">
              <label
                for="tip-suggested-category"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Suggested category
              </label>
              <UInput
                id="tip-suggested-category"
                v-model.trim="form.suggested_category"
                type="text"
                placeholder="e.g. Threat hunting"
                color="neutral"
                variant="subtle"
                class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                :disabled="submitting"
              />
              <p v-if="errors.suggested_category" class="text-xs text-red-200">{{ errors.suggested_category }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <label for="tip-body" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
              Tip body
            </label>
            <UTextarea
              id="tip-body"
              v-model.trim="form.body"
              :rows="10"
              :maxlength="10000"
	              placeholder="Write the tip in Markdown — use headings, bullets, checklists, etc."
              color="neutral"
              variant="subtle"
              class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
              :disabled="submitting"
            />
            <p v-if="errors.body" class="text-xs text-red-200">{{ errors.body }}</p>
          </div>

          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div class="space-y-2">
              <label
                for="tip-name"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Your name
              </label>
              <UInput
                id="tip-name"
                v-model.trim="form.submitter_name"
                type="text"
                autocomplete="name"
                placeholder="Your name"
                color="neutral"
                variant="subtle"
                class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                :disabled="submitting"
              />
              <p v-if="errors.submitter_name" class="text-xs text-red-200">{{ errors.submitter_name }}</p>
            </div>

            <div class="space-y-2">
              <label
                for="tip-email"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Email (optional)
              </label>
              <UInput
                id="tip-email"
                v-model.trim="form.submitter_email"
                type="email"
                autocomplete="email"
                placeholder="you@company.com"
                color="neutral"
                variant="subtle"
                class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                :disabled="submitting"
              />
              <p v-if="errors.submitter_email" class="text-xs text-red-200">{{ errors.submitter_email }}</p>
              <p class="text-xs text-tn-on-surface-variant">Used only for rate limiting (max 3 submissions/day).</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="submitting"
              @click="reset"
            >
              Reset
            </UButton>
            <UButton
              type="submit"
              :loading="submitting"
              class="cursor-pointer rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110 disabled:opacity-70"
            >
              Submit tip
            </UButton>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
type TipCategory = {
  id: string
  name: string
  slug: string
}

type CategoriesResponse = { items: TipCategory[] }

definePageMeta({ layout: 'default' })

useSeoMeta({
	  title: 'Suggest a Tip — ThreatNoir',
  description: 'Suggest a new security tip for the ThreatNoir Tips & Tricks library.'
})

const { data: categoriesData } = await useFetch<CategoriesResponse>('/api/tips/categories')
const categories = computed(() => categoriesData.value?.items ?? [])

const categoryOptions = computed(() => {
  const base = categories.value.map((c) => ({ label: c.name, value: c.slug }))
	  return [...base, { label: 'Suggest new…', value: '__new__' }]
})

const form = reactive<{
  title: string
  category: string
  suggested_category: string
  body: string
  submitter_name: string
  submitter_email: string
}>(
  {
    title: '',
    category: '',
    suggested_category: '',
    body: '',
    submitter_name: '',
    submitter_email: ''
  }
)

const errors = reactive<Record<string, string | undefined>>({})
const submitting = ref(false)
const success = ref(false)
const successMessage = ref('Thanks! Your tip has been submitted for review.')
const errorMessage = ref<string | null>(null)

function clearErrors() {
  for (const k of Object.keys(errors)) errors[k] = undefined
}

function isValidEmail(v: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())
}

function validate() {
  clearErrors()

  const title = form.title.trim()
  const body = form.body.trim()
  const name = form.submitter_name.trim()
  const email = form.submitter_email.trim()
  const suggested = form.suggested_category.trim()

  if (!title) errors.title = 'Title is required.'
  else if (title.length < 3) errors.title = 'Title must be at least 3 characters.'
  else if (title.length > 200) errors.title = 'Title must be at most 200 characters.'

  if (!body) errors.body = 'Body is required.'
  else if (body.length < 10) errors.body = 'Body must be at least 10 characters.'
  else if (body.length > 10_000) errors.body = 'Body must be at most 10,000 characters.'

  if (!name) errors.submitter_name = 'Name is required.'

  if (email && !isValidEmail(email)) errors.submitter_email = 'Enter a valid email address.'

  if (form.category === '__new__' && !suggested) {
    errors.suggested_category = 'Please suggest a category name.'
  }

  return !Object.values(errors).some(Boolean)
}

function reset() {
  form.title = ''
  form.category = ''
  form.suggested_category = ''
  form.body = ''
  form.submitter_name = ''
  form.submitter_email = ''
  clearErrors()
  success.value = false
  errorMessage.value = null
}

function clearForm() {
	form.title = ''
	form.category = ''
	form.suggested_category = ''
	form.body = ''
	form.submitter_name = ''
	form.submitter_email = ''
	clearErrors()
}

async function onSubmit() {
  success.value = false
  errorMessage.value = null

  if (!validate()) {
    errorMessage.value = 'Please fix the highlighted fields and try again.'
    return
  }

  submitting.value = true
  try {
    const suggestedCategory =
      form.category === '__new__' ? form.suggested_category.trim() : form.category.trim() || null

    const res = await $fetch<{ success: boolean; message: string }>('/api/tips/submit', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        body: form.body.trim(),
        suggested_category: suggestedCategory,
        submitter_name: form.submitter_name.trim(),
        submitter_email: form.submitter_email.trim() || undefined
      }
    })

    successMessage.value = res?.message || 'Thanks! Your tip has been submitted for review.'
	    success.value = true
	    clearForm()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not submit your tip. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>
