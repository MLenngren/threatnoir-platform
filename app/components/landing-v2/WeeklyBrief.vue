<template>
	<section class="mx-auto max-w-[1180px] px-[28px] py-[56px]">
		<header class="mb-[22px] flex items-end justify-between">
			<div>
				<h2 class="m-0 text-[26px] font-bold tracking-[-0.01em] text-tn-on-surface">Weekly Brief</h2>
				<p class="mt-[6px] text-[14px] text-tn-ink-dim">The week in cyber, summarized.</p>
			</div>
			<NuxtLink
				to="/weekly"
				class="inline-flex items-center gap-[6px] text-[14px] text-tn-accent transition-colors hover:text-tn-accent/90"
			>
				<span>View all weekly briefs</span>
				<span aria-hidden="true">→</span>
			</NuxtLink>
		</header>

		<article
			class="flex items-center gap-[28px] rounded-[12px] border border-tn-line-deep bg-tn-card-deep p-[28px]"
			style="border-left-width: 3px; border-left-color: var(--color-tn-accent);"
		>
			<div
				class="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[14px]"
				style="background: rgba(46, 230, 200, 0.10); border: 1px solid rgba(46, 230, 200, 0.25);"
			>
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-tn-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="5" width="18" height="16" rx="2" />
					<path d="M3 9h18" />
					<path d="M8 3v4M16 3v4" />
				</svg>
			</div>

			<div class="min-w-0 flex-1">
				<h3 class="m-0 text-[18px] font-semibold text-tn-on-surface">
					{{ weekly?.weekLabel || 'No published weekly brief yet.' }}
				</h3>
				<ul class="mt-[12px] flex list-none flex-col gap-[6px] p-0">
					<li
						v-for="(b, i) in (weekly?.bullets?.length ? weekly.bullets : fallbackBullets)"
						:key="`w-${i}`"
						class="flex gap-[10px] text-[13.5px] text-tn-ink-dim"
						style="line-height: 1.5;"
					>
						<span class="text-tn-accent" style="margin-top: 1px;">•</span>
						<span class="min-w-0">{{ b }}</span>
					</li>
				</ul>
			</div>

			<NuxtLink
				:to="weekly?.slug ? `/weekly/${weekly.slug}` : '/weekly'"
				class="inline-flex shrink-0 items-center gap-[10px] rounded-[8px] border border-tn-accent bg-tn-accent/12 px-[20px] py-[12px] text-[14px] font-medium text-tn-accent transition-all duration-200 hover:bg-tn-accent/20"
			>
				<span>Read full weekly brief</span>
				<span aria-hidden="true">→</span>
			</NuxtLink>
		</article>
	</section>
</template>

<script setup lang="ts">
type WeeklyBrief = {
	weekLabel: string
	slug: string
	bullets: string[]
}

const { data } = await useFetch<WeeklyBrief | null>('/api/landing/weekly-brief', {
	key: 'landing-weekly-brief'
})

const weekly = computed(() => data.value ?? null)

const fallbackBullets = [
	'Watch for the next roundup.',
	'New weekly briefs publish once per week.'
]
</script>
