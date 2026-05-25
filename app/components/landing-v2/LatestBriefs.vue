<template>
	<section class="mx-auto max-w-[1180px] px-[28px] py-[56px]">
		<header class="mb-[22px] flex items-baseline justify-between">
			<h2 class="m-0 text-[26px] font-bold tracking-[-0.01em] text-tn-on-surface">Latest Briefs</h2>
			<NuxtLink
				to="/brief"
				class="inline-flex items-center gap-[6px] text-[14px] text-tn-accent transition-colors hover:text-tn-accent/90"
			>
				<span>View all briefs</span>
				<span aria-hidden="true">→</span>
			</NuxtLink>
		</header>

		<div class="grid gap-[20px] md:grid-cols-2">
			<!-- Morning -->
			<article
				class="flex flex-col rounded-[12px] border border-tn-line-deep bg-tn-card-deep p-[24px]"
				style="border-left-width: 3px; border-left-color: var(--color-tn-morning);"
			>
				<header class="mb-[16px] flex items-center justify-between">
					<div class="flex items-center gap-[8px]">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-tn-morning" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
							<circle cx="12" cy="12" r="4" />
							<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
						</svg>
						<span class="text-[15px] font-semibold text-tn-morning-soft">
							{{ morning?.edition || 'Morning Brief' }}
						</span>
					</div>
					<div class="font-mono text-[12px] text-tn-ink-mute">
						{{ morning ? `${morning.date} · ${morning.time}` : '—' }}
					</div>
				</header>

				<div class="flex items-start gap-[18px]">
					<div class="min-w-0 flex-1">
						<h3 class="m-0 text-[19px] font-semibold tracking-[-0.005em] text-tn-on-surface" style="line-height: 1.3;">
							{{ morning?.title || 'No morning brief yet.' }}
						</h3>
						<ul class="mt-[14px] flex list-none flex-col gap-[8px] p-0">
							<li
								v-for="(b, i) in (morning?.bullets?.length ? morning.bullets : fallbackBullets)"
								:key="`m-${i}`"
								class="flex gap-[10px] text-[13.5px] text-tn-ink-dim"
								style="line-height: 1.5;"
							>
								<span class="text-tn-morning" style="margin-top: 1px;">•</span>
								<span class="min-w-0">{{ b }}</span>
							</li>
						</ul>
					</div>

					<div class="flex flex-col items-center gap-[10px] pt-[4px]">
						<div
							class="flex h-[52px] w-[52px] items-center justify-center rounded-full"
							style="background: rgba(244, 176, 46, 0.14);"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="text-tn-morning" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="12" y1="7" x2="12" y2="13" />
								<circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
							</svg>
						</div>
						<span
							class="inline-flex items-center justify-center rounded-[4px] px-[12px] py-[4px] text-[11px] font-semibold"
							style="letter-spacing: 0.06em; text-transform: uppercase; background: rgba(244, 176, 46, 0.14); color: var(--color-tn-morning);"
						>
							{{ morning?.severity || 'HIGH' }}
						</span>
					</div>
				</div>

				<NuxtLink
					:to="morning?.link || '/podcast'"
					class="mt-[22px] inline-flex items-center gap-[6px] text-[14px] font-medium text-tn-morning-soft transition-colors hover:text-tn-accent"
				>
					<span>Read full brief</span>
					<span aria-hidden="true">→</span>
				</NuxtLink>
			</article>

			<!-- Evening -->
			<article
				class="flex flex-col rounded-[12px] border border-tn-line-deep bg-tn-card-deep p-[24px]"
				style="border-left-width: 3px; border-left-color: var(--color-tn-evening);"
			>
				<header class="mb-[16px] flex items-center justify-between">
					<div class="flex items-center gap-[8px]">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-tn-evening" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
						</svg>
						<span class="text-[15px] font-semibold text-tn-evening-soft">
							{{ evening?.edition || 'Evening Brief' }}
						</span>
					</div>
					<div class="font-mono text-[12px] text-tn-ink-mute">
						{{ evening ? `${evening.date} · ${evening.time}` : '—' }}
					</div>
				</header>

				<div class="flex items-start gap-[18px]">
					<div class="min-w-0 flex-1">
						<h3 class="m-0 text-[19px] font-semibold tracking-[-0.005em] text-tn-on-surface" style="line-height: 1.3;">
							{{ evening?.title || 'No evening brief yet.' }}
						</h3>
						<ul class="mt-[14px] flex list-none flex-col gap-[8px] p-0">
							<li
								v-for="(b, i) in (evening?.bullets?.length ? evening.bullets : fallbackBullets)"
								:key="`e-${i}`"
								class="flex gap-[10px] text-[13.5px] text-tn-ink-dim"
								style="line-height: 1.5;"
							>
								<span class="text-tn-evening" style="margin-top: 1px;">•</span>
								<span class="min-w-0">{{ b }}</span>
							</li>
						</ul>
					</div>

					<div class="flex flex-col items-center gap-[10px] pt-[4px]">
						<div
							class="flex h-[52px] w-[52px] items-center justify-center rounded-full"
							style="background: rgba(63, 169, 245, 0.14);"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="text-tn-evening" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="12" y1="7" x2="12" y2="13" />
								<circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
							</svg>
						</div>
						<span
							class="inline-flex items-center justify-center rounded-[4px] px-[12px] py-[4px] text-[11px] font-semibold"
							style="letter-spacing: 0.06em; text-transform: uppercase; background: rgba(63, 169, 245, 0.14); color: var(--color-tn-evening);"
						>
							{{ evening?.severity || 'MEDIUM' }}
						</span>
					</div>
				</div>

				<NuxtLink
					:to="evening?.link || '/podcast'"
					class="mt-[22px] inline-flex items-center gap-[6px] text-[14px] font-medium text-tn-evening-soft transition-colors hover:text-tn-accent"
				>
					<span>Read full brief</span>
					<span aria-hidden="true">→</span>
				</NuxtLink>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
type Brief = {
	edition: string
	date: string
	time: string
	title: string
	bullets: string[]
	severity: string
	link: string
}

type LatestBriefsResponse = {
	morning: Brief | null
	evening: Brief | null
}

const { data } = await useFetch<LatestBriefsResponse>('/api/landing/latest-briefs', {
	key: 'landing-latest-briefs'
})

const morning = computed(() => data.value?.morning ?? null)
const evening = computed(() => data.value?.evening ?? null)

const fallbackBullets = [
	'No highlights available yet.',
	'Check back soon.',
	'New briefings publish daily.'
]
</script>
