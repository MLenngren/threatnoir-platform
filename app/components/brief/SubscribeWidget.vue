<template>
	<section :style="{ padding: '24px 0 28px' }" aria-label="Subscribe to the brief">
		<div
			:style="{
				display: 'flex',
				flexDirection: 'column',
				gap: '14px',
				padding: '16px 18px',
				background: 'var(--color-tn-card-deep)',
				border: '1px solid var(--color-tn-line-deep)',
				borderRadius: '10px'
			}"
			class="md:flex-row md:items-center md:justify-between"
		>
			<div :style="{ flex: '1 1 auto' }">
				<div :style="{ fontSize: '15px', fontWeight: '700', color: 'var(--color-tn-on-surface)' }">Get the daily brief in your inbox</div>
				<p class="text-tn-ink-dim" :style="{ margin: '6px 0 0', fontSize: '13px', lineHeight: '1.45' }">
					Morning &amp; evening editions. No spam. Unsubscribe anytime.
				</p>
			</div>

			<div :style="{ flex: '0 0 auto' }" class="w-full md:w-auto">
				<p v-if="submitted" class="font-mono" :style="{ margin: 0, color: '#2EE6C8', fontSize: '13px' }">
					✓ Check your email to confirm.
				</p>
				<form v-else class="flex flex-col gap-2 md:flex-row md:items-start" @submit.prevent="submitEmail">
					<div class="w-full md:w-[340px]">
						<label class="sr-only" for="brief-inline-email">Email address</label>
						<input
							id="brief-inline-email"
							v-model.trim="email"
							type="email"
							inputmode="email"
							autocomplete="email"
							required
							placeholder="you@company.com"
							class="w-full rounded-lg bg-tn-surface-lowest/60 px-4 py-2.5 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
							:disabled="submitting"
							:aria-invalid="!!error"
							:aria-describedby="error || note ? 'brief-inline-email-msg' : undefined"
						>
						<p
							v-if="error || note"
							id="brief-inline-email-msg"
							:style="{ margin: '6px 0 0', fontSize: '12px' }"
							:class="error ? 'text-red-300' : 'text-tn-ink-dim'"
							role="alert"
						>
							{{ error || note }}
						</p>
					</div>

					<button
						type="submit"
						class="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
						:style="{ background: '#4CD7F6' }"
						:disabled="submitting"
					>
						<span v-if="submitting">Subscribing...</span>
						<span v-else>Subscribe</span>
					</button>
				</form>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')
const note = ref('')

async function submitEmail() {
	const e = email.value.trim()
	if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
		error.value = 'Please enter a valid email'
		note.value = ''
		return
	}

	submitting.value = true
	error.value = ''
	note.value = ''
	try {
		await $fetch('/api/subscribe', {
			method: 'POST',
			body: { email: e, preferences: { all: true }, source: 'brief_inline' }
		})
		submitted.value = true
	} catch (e: unknown) {
		const err = e as Record<string, unknown> | null
		const data = (err && typeof err === 'object' ? (err.data as Record<string, unknown> | undefined) : undefined)
		const msg = typeof data?.statusMessage === 'string' ? data.statusMessage : null
		const statusCode =
			typeof (err as { statusCode?: unknown } | null)?.statusCode === 'number'
				? ((err as { statusCode?: number }).statusCode ?? null)
				: typeof (err as { response?: { status?: unknown } } | null)?.response?.status === 'number'
					? ((err as { response?: { status?: number } }).response?.status ?? null)
					: null

		if (statusCode === 409) {
			note.value = "You're already on the list — check your inbox."
			return
		}

		error.value = msg || 'Something went wrong. Try again.'
	} finally {
		submitting.value = false
	}
}
</script>
