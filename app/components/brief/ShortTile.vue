<template>
	<a
		href="https://www.youtube.com/@ThreatNoir/shorts"
		target="_blank"
		rel="noopener noreferrer"
		class="block"
		:style="{ textDecoration: 'none' }"
	>
		<article
			:style="{
				display: 'flex',
				flexDirection: 'column',
				gap: '16px',
				padding: '20px',
				background: 'var(--color-tn-bg-2, var(--color-tn-card-deep))',
				border: '1px solid var(--color-tn-line-deep)',
				borderRadius: '10px'
			}"
		>
			<div
				:style="{
					alignSelf: 'flex-start',
					padding: '4px 10px',
					background: 'rgba(46,230,200,0.15)',
					color: 'var(--color-tn-accent)',
					fontSize: '11px',
					fontWeight: '700',
					letterSpacing: '0.08em',
					borderRadius: '4px'
				}"
			>
				SHORT
			</div>

			<div :style="{ display: 'flex', justifyContent: 'center', padding: '12px 0' }">
				<div
					:style="{
						width: '108px',
						height: '180px',
						borderRadius: '14px',
						border: '2px solid var(--color-tn-line-deep-2)',
						overflow: 'hidden',
						position: 'relative'
					}"
				>
					<img
						src="/shorts-poster.jpg"
						alt=""
						loading="lazy"
						:style="{
							position: 'absolute',
							inset: 0,
							width: '100%',
							height: '100%',
							objectFit: 'cover'
						}"
					>
					<div
						:style="{
							position: 'absolute',
							inset: 0,
							background: 'linear-gradient(180deg, rgba(7,19,26,0.15) 0%, rgba(7,19,26,0.55) 70%, rgba(7,19,26,0.85) 100%)'
						}"
					/>
					<div
						:style="{
							position: 'absolute',
							top: '50%',
							left: '50%',
							transform: 'translate(-50%, -50%)',
							width: '40px',
							height: '40px',
							borderRadius: '50%',
							background: 'rgba(0,0,0,0.55)',
							border: '1.5px solid #fff',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
					</div>
					<div
						:style="{
							position: 'absolute',
							left: '8px',
							bottom: '8px',
							right: '8px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							fontFamily: 'var(--font-mono)',
							fontSize: '10px',
							color: '#fff'
						}"
					>
						<span :style="{ fontWeight: '700', letterSpacing: '0.06em' }">SHORTS</span>
						<span :style="{ opacity: '0.85' }">:60</span>
					</div>
				</div>
			</div>

			<div>
				<h4 :style="{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-tn-on-surface)' }">2 stories in 60 seconds</h4>
				<p class="text-tn-ink-dim" :style="{ margin: '6px 0 0', fontSize: '13px', lineHeight: '1.5' }">
					Quick overview of today's<br>
					key events.
				</p>
			</div>

			<div :style="{ borderTop: '1px solid var(--color-tn-line-deep)', paddingTop: '14px', marginTop: 'auto' }">
				<span :style="{ fontSize: '13px', color: 'var(--color-tn-accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }">
					Watch on YouTube <span aria-hidden="true">→</span>
				</span>
			</div>
		</article>
	</a>
</template>
