<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Hero -->
      <header class="mb-10 md:mb-14">
        <div class="flex items-center gap-3">
          <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
          <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Secure channel active</span>
        </div>

        <h1 class="mt-4 text-balance font-headline text-5xl font-black tracking-tight text-tn-on-surface md:text-7xl">
          CONTACT &amp;<br>
          <span class="text-tn-primary-container">LEGAL</span>
        </h1>

        <p class="mt-4 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          Reach the ThreatNoir team through a secure channel, or review the legal and compliance frameworks that govern our
          curated intelligence distribution.
        </p>
      </header>

      <!-- Main grid -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- Form -->
        <section class="glass-panel rounded-2xl p-6 md:p-8 lg:col-span-7">
          <div class="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 class="font-headline text-lg font-black tracking-tight text-tn-on-surface md:text-xl">
                Secure Communication Channel
              </h2>
              <p class="mt-1 text-sm text-tn-on-surface-variant">
                Use this form for general inquiries, bug reports, partnerships, or legal questions.
              </p>
            </div>
            <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
              Transport: TLS 1.3
            </div>
          </div>

          <form class="mt-6 space-y-5" @submit.prevent="onSubmit">
            <!-- Honeypot — hidden from real users, bots fill it -->
            <div class="absolute -left-[9999px] opacity-0" aria-hidden="true" tabindex="-1">
              <label for="contact-website">Website</label>
              <input id="contact-website" v-model="form.website" type="text" autocomplete="off" tabindex="-1">
            </div>

            <UAlert v-if="success" color="primary" variant="soft" title="Message queued">
              Thanks—your message has been captured. We’ll respond as soon as possible.
            </UAlert>

            <UAlert v-if="errorMessage" color="red" variant="soft" title="Check the form">
              {{ errorMessage }}
            </UAlert>

            <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div class="space-y-2">
                <label
                  for="contact-name"
                  class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
                >
                  Name
                </label>
                <UInput
                  id="contact-name"
                  v-model.trim="form.name"
                  type="text"
                  autocomplete="name"
                  placeholder="Your name"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                  :disabled="submitting"
                />
                <p v-if="errors.name" class="text-xs text-red-200">{{ errors.name }}</p>
              </div>

              <div class="space-y-2">
                <label
                  for="contact-email"
                  class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
                >
                  Email
                </label>
                <UInput
                  id="contact-email"
                  v-model.trim="form.email"
                  type="email"
                  autocomplete="email"
                  placeholder="you@company.com"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                  :disabled="submitting"
                />
                <p v-if="errors.email" class="text-xs text-red-200">{{ errors.email }}</p>
              </div>
            </div>

            <div class="space-y-2">
              <label
                for="contact-subject"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Subject
              </label>
              <select
                id="contact-subject"
                v-model="form.subject"
                class="w-full bg-tn-surface-lowest/60 px-3 py-2 text-sm text-tn-on-surface ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus:outline-none focus:border-tn-primary"
                :disabled="submitting"
              >
                <option v-for="o in subjectOptions" :key="o" :value="o">{{ o }}</option>
              </select>
              <p v-if="errors.subject" class="text-xs text-red-200">{{ errors.subject }}</p>
            </div>

            <div class="space-y-2">
              <label
                for="contact-message"
                class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant"
              >
                Message
              </label>
              <UTextarea
                id="contact-message"
                v-model.trim="form.message"
                :rows="6"
                :maxlength="4000"
                placeholder="Write your message…"
                color="neutral"
                variant="subtle"
                class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                :disabled="submitting"
              />
              <p v-if="errors.message" class="text-xs text-red-200">{{ errors.message }}</p>
            </div>

            <UButton
              :loading="submitting"
              block
              type="submit"
              class="cursor-pointer rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110 disabled:opacity-70"
            >
              Send message
            </UButton>

            <p class="text-xs text-tn-on-surface-variant">
              Prefer email? Write to
              <a href="mailto:contact@threatnoir.com" class="text-tn-primary hover:underline">contact@threatnoir.com</a>.
            </p>
          </form>
        </section>

        <!-- Contact info -->
        <aside class="space-y-6 lg:col-span-5">
          <section class="glass-panel rounded-2xl p-6 md:p-8">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-identification" class="h-5 w-5 text-tn-primary" />
              <h2 class="font-headline text-lg font-black tracking-tight text-tn-on-surface md:text-xl">Contact details</h2>
            </div>

            <dl class="mt-6 space-y-5">
              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-envelope" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div class="min-w-0">
                  <dt class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Email</dt>
                  <dd class="mt-1 text-sm text-tn-on-surface">
                    <a href="mailto:contact@threatnoir.com" class="hover:underline">contact@threatnoir.com</a>
                  </dd>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-map-pin" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <dt class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Location</dt>
                  <dd class="mt-1 text-sm text-tn-on-surface">Stockholm, Sweden</dd>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-clock" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <dt class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Response window</dt>
                  <dd class="mt-1 text-sm text-tn-on-surface">Typically 1–2 business days</dd>
                </div>
              </div>
            </dl>
          </section>

          <NuxtLink
            to="/legal"
            class="glass-panel group block rounded-2xl p-6 transition-colors hover:bg-tn-surface-high/40"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Knowledge base</div>
                <div class="mt-1 font-headline text-base font-bold text-tn-on-surface">Policies &amp; compliance docs</div>
                <div class="mt-1 text-sm text-tn-on-surface-variant">Review privacy, terms, and data processing details.</div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-tn-primary transition-transform group-hover:translate-x-0.5" />
            </div>
          </NuxtLink>
        </aside>
      </div>

      <!-- Legal -->
      <section class="mt-12 md:mt-16">
        <div class="flex items-center gap-4">
          <h2 class="font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-4xl">
            Legal &amp; <span class="text-tn-on-surface-variant">Compliance</span>
          </h2>
          <div class="h-px flex-1 bg-white/10" />
        </div>

        <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="c in legalCards"
            :key="c.title"
            class="rounded-2xl bg-tn-surface-low/70 p-6 ring-1 ring-white/10 transition-colors hover:ring-tn-primary/20"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="c.icon" class="h-5 w-5 text-tn-primary" />
              <h3 class="font-headline text-sm font-bold uppercase tracking-widest text-tn-on-surface">{{ c.title }}</h3>
            </div>

            <p class="mt-4 text-sm leading-6 text-tn-on-surface-variant">{{ c.body }}</p>

            <NuxtLink
              to="/legal"
              class="mt-4 inline-flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary hover:underline"
            >
              View full document
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            </NuxtLink>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Contact & Legal — ThreatNoir',
  description: 'Contact the ThreatNoir team and review legal and compliance information.'
})

const subjectOptions = ['General Inquiry', 'Bug Report', 'Legal Inquiry', 'Partnership'] as const
type SubjectOption = (typeof subjectOptions)[number]

const form = reactive<{ name: string; email: string; subject: SubjectOption; message: string; website: string }>({
  name: '',
  email: '',
  subject: 'General Inquiry',
  message: '',
  website: '' // honeypot
})

const errors = reactive<{ name?: string; email?: string; subject?: string; message?: string }>({})
const submitting = ref(false)
const success = ref(false)
const errorMessage = ref<string | null>(null)

const legalCards = [
  {
    icon: 'i-heroicons-scale',
    title: 'Imprint',
		body: 'Operator and registration details available upon request.'
  },
  {
    icon: 'i-heroicons-shield-check',
    title: 'Privacy protocol',
    body: 'How we handle analytics, subscriptions, and data retention—designed for a privacy-first news workflow.'
  },
  {
    icon: 'i-heroicons-document-text',
    title: 'Terms of service',
    body: 'Platform usage terms, limitations, and acceptable use guidelines for interacting with ThreatNoir content.'
  },
  {
    icon: 'i-heroicons-circle-stack',
    title: 'Data processing',
    body: 'GDPR-aligned processing details for newsletter subscriptions, account access, and operational telemetry.'
  }
] as const

function clearErrors() {
  errors.name = undefined
  errors.email = undefined
  errors.subject = undefined
  errors.message = undefined
}

function isValidEmail(v: string) {
  // pragmatic email check (no RFC gymnastics)
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
}

function validate() {
  clearErrors()

  const name = form.name.trim()
  const email = form.email.trim()
  const message = form.message.trim()

  if (!name) errors.name = 'Name is required.'
  if (!email) errors.email = 'Email is required.'
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.'
  if (!form.subject) errors.subject = 'Subject is required.'
  if (!message) errors.message = 'Message is required.'

  return !errors.name && !errors.email && !errors.subject && !errors.message
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
    // Stubbed endpoint (no email delivery yet). Keeps the UI aligned with a future Resend integration.
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
        website: form.website
      }
    })

    success.value = true
    form.name = ''
    form.email = ''
    form.subject = 'General Inquiry'
    form.message = ''
    clearErrors()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not send your message. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>