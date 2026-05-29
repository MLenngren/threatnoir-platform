<template>
	<section class="relative overflow-hidden bg-tn-surface-deep">
		<!-- Threatmap (right) -->
		<div class="pointer-events-none absolute right-0 top-0 h-full w-[70%]">
			<img
				src="/threatmap.png"
				alt=""
				class="block h-full w-full object-cover object-right opacity-[0.85]"
				style="mix-blend-mode: screen; filter: brightness(1.15) contrast(1.1) saturate(1.1);"
			>
		</div>

		<!-- Gradient fade (left) -->
		<div
			class="pointer-events-none absolute left-0 top-0 h-full w-[70%]"
			style="background: linear-gradient(90deg, var(--color-tn-surface-deep) 25%, rgba(7, 19, 26, 0.6) 60%, transparent 100%);"
		/>

		<div class="relative mx-auto max-w-[1180px] px-[28px] pb-[100px] pt-[80px]">
			<div style="max-width: 540px;">
				<h1
					class="text-tn-on-surface"
					style="margin: 0; font-size: 72px; line-height: 1; font-weight: 800; letter-spacing: -0.025em;"
				>
					{{ site.name }}<br>
					<span class="text-tn-primary">Daily Brief</span>
				</h1>

				<p class="text-tn-ink-dim" style="font-size: 17px; line-height: 1.55; margin-top: 28px; margin-bottom: 8px;">
					AI-filtered cyber intelligence for security practitioners.
				</p>
				<p class="text-tn-ink-dim" style="font-size: 17px; line-height: 1.55; margin-top: 0;">
					Morning &amp; Evening briefings. No noise. Just signal.
				</p>

				<div class="mt-[36px] flex gap-[12px]">
					<NuxtLink
						to="/brief"
						class="inline-flex items-center gap-[10px] rounded-[8px] border border-tn-accent bg-tn-accent/12 px-[20px] py-[12px] text-[14px] font-medium text-tn-accent transition-all duration-200 hover:bg-tn-accent/20"
					>
						<span>View Latest Brief</span>
						<span aria-hidden="true">→</span>
					</NuxtLink>

					<NuxtLink
						to="/show"
						class="inline-flex items-center gap-[10px] rounded-[8px] border border-tn-line-deep-2 px-[20px] py-[12px] text-[14px] font-medium text-tn-on-surface transition-all duration-200 hover:border-tn-accent hover:text-tn-accent"
					>
						<span>Explore Red vs Blue</span>
						<span aria-hidden="true">→</span>
					</NuxtLink>
				</div>

				<div class="mt-[40px] flex items-center gap-[16px]">
					<span class="text-tn-ink-mute" style="font-size: 12px;">Supported by</span>
					<NuxtLink
						v-if="!sponsor"
						to="/contact?topic=sponsorship"
						class="text-tn-accent transition-opacity hover:opacity-80"
						style="font-size: 18px; font-weight: 700; letter-spacing: 0.06em;"
					>
						Your brand here <span aria-hidden="true">→</span>
					</NuxtLink>
					<span
						v-else
						class="text-tn-accent"
						style="font-size: 18px; font-weight: 700; letter-spacing: 0.06em;"
					>
						{{ sponsor.toUpperCase() }}
					</span>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const sponsor = computed(() => (config.public.sponsorLabel || '').trim())
	const site = useSiteConfig()
</script>
