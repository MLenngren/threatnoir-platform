<template>
	<section class="mx-auto max-w-[1180px] px-[28px] py-[56px]">
		<header class="mb-[22px] flex items-end justify-between">
			<div>
				<h2 class="m-0 text-[26px] font-bold tracking-[-0.01em] text-tn-on-surface">Red vs Blue</h2>
				<p class="mt-[6px] text-[14px] text-tn-ink-dim">
					Real attacks. Real defenses. One minute to become stronger.
				</p>
			</div>
			<NuxtLink
				to="/show"
				class="inline-flex items-center gap-[6px] text-[14px] text-tn-accent transition-colors hover:text-tn-accent/90"
			>
				<span>View all episodes</span>
				<span aria-hidden="true">→</span>
			</NuxtLink>
		</header>

		<div class="grid gap-[20px] md:grid-cols-3">
			<article v-for="(ep, idx) in items" :key="ep.slug" class="flex flex-col gap-[14px]">
				<NuxtLink :to="`/show/${ep.slug}`" class="block">
					<div class="relative overflow-hidden rounded-[10px]" style="aspect-ratio: 16 / 9; background: #0a1820;">
							<img
								v-if="ep.thumbnailUrl"
								:src="ep.thumbnailUrl"
								alt=""
								class="absolute inset-0 h-full w-full object-cover"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>

							<template v-else>
								<!-- split background tint -->
								<div
									class="absolute inset-0"
									style="background: linear-gradient(90deg, rgba(255, 77, 77, 0.55) 0%, rgba(255, 77, 77, 0.18) 45%, rgba(63, 169, 245, 0.18) 55%, rgba(63, 169, 245, 0.55) 100%);"
								/>

								<!-- scanlines + divider + iconography -->
								<svg viewBox="0 0 124 70" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
									<line
										v-for="i in 30"
										:key="`sl-${idx}-${i}`"
										:x1="(i - 1) * 4.2"
										y1="0"
										:x2="(i - 1) * 4.2"
										y2="70"
										stroke="rgba(255,255,255,0.05)"
										stroke-width="0.4"
									/>
									<line
										x1="62"
										y1="0"
										x2="62"
										y2="70"
										stroke="rgba(255,255,255,0.5)"
										stroke-width="0.4"
										stroke-dasharray="2 2"
									/>

									<!-- decorative iconography by tone -->
									<g v-if="ep.tone === 'people'">
										<circle cx="38" cy="32" r="6" fill="rgba(255,77,77,0.7)" />
										<rect x="28" y="38" width="20" height="18" fill="rgba(255,77,77,0.5)" rx="2" />
										<circle cx="86" cy="30" r="6" fill="rgba(63,169,245,0.7)" />
										<rect x="76" y="36" width="20" height="20" fill="rgba(63,169,245,0.5)" rx="2" />
									</g>
									<g v-else-if="ep.tone === 'lock'">
										<rect x="30" y="34" width="18" height="20" fill="none" stroke="#FF4D4D" stroke-width="2" rx="2" />
										<path d="M34 34 V28 a5 5 0 0 1 10 0 V34" stroke="#FF4D4D" stroke-width="2" fill="none" />
										<rect x="76" y="34" width="18" height="20" fill="none" stroke="#3FA9F5" stroke-width="2" rx="2" />
										<path d="M80 34 V28 a5 5 0 0 1 10 0 V34" stroke="#3FA9F5" stroke-width="2" fill="none" />
									</g>
									<g v-else>
										<path
											d="M30 32 q0 -10 10 -10 q10 0 10 10 v6 l-3 3 v5 h-14 v-5 l-3 -3 z"
											fill="none"
											stroke="#FF4D4D"
											stroke-width="2"
											stroke-linejoin="round"
										/>
										<circle cx="36" cy="34" r="1.6" fill="#FF4D4D" />
										<circle cx="44" cy="34" r="1.6" fill="#FF4D4D" />
										<path
											d="M78 26 l13 3 v11 q0 10 -13 14 q-13 -4 -13 -14 v-11 z"
											fill="none"
											stroke="#3FA9F5"
											stroke-width="2"
											stroke-linejoin="round"
										/>
										<path d="M78 34 v12" stroke="#3FA9F5" stroke-width="2" />
									</g>
								</svg>
							</template>

							<div
								v-if="ep.thumbnailUrl"
								class="pointer-events-none absolute inset-0"
								style="background: linear-gradient(180deg, rgba(7,19,26,0.65) 0%, rgba(7,19,26,0.15) 30%, rgba(7,19,26,0.15) 70%, rgba(7,19,26,0.7) 100%);"
							/>

						<!-- ATTACK / vs / DEFEND -->
						<div class="absolute left-0 right-0 top-[14px] flex items-center justify-between px-[16px]">
							<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; color: #fff; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);">
								ATTACK
							</span>
							<span style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.85); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);">
								vs
							</span>
							<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; color: #fff; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);">
								DEFEND
							</span>
						</div>

						<!-- play button center -->
						<div
							style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; border-radius: 9999px; background: rgba(7, 19, 26, 0.7); border: 1.5px solid rgba(255, 255, 255, 0.85); display: flex; align-items: center; justify-content: center;"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
						</div>

						<!-- duration -->
						<div class="absolute bottom-[10px] right-[10px] rounded-[3px] px-[6px] py-[2px] font-mono text-[11px] text-white" style="background: rgba(0, 0, 0, 0.65);">
							{{ ep.durationLabel }}
						</div>
					</div>
				</NuxtLink>

				<div>
					<NuxtLink :to="`/show/${ep.slug}`" class="block">
						<h3 class="m-0 text-[17px] font-semibold tracking-[-0.005em] text-tn-on-surface">{{ ep.title }}</h3>
					</NuxtLink>
					<p class="mt-[8px] text-[13.5px] text-tn-ink-dim" style="line-height: 1.5;">
						{{ ep.description }}
					</p>
				</div>

				<NuxtLink
					:to="`/show/${ep.slug}`"
					class="inline-flex items-center gap-[6px] text-[13.5px] text-tn-accent transition-colors hover:text-tn-accent/90"
				>
					<span>Watch now</span>
					<span aria-hidden="true">→</span>
				</NuxtLink>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
type Tone = 'people' | 'lock' | 'skull'

type Episode = {
	title: string
	description: string
	slug: string
	durationLabel: string
	tone: Tone
	thumbnailUrl: string | null
}

type RedVsBlueResponse = {
	items: Episode[]
}

const { data } = await useFetch<RedVsBlueResponse>('/api/landing/red-vs-blue', {
	key: 'landing-red-vs-blue'
})

const items = computed(() => (Array.isArray(data.value?.items) ? data.value!.items : []))
</script>
