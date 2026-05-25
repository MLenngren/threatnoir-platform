import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {BriefingProps, SegmentProps} from '../schema';

type Props = {
  audience: BriefingProps['audience'];
  segment: SegmentProps;
  segmentIndex: number;
  totalSegments: number;
  durationInFrames: number;
};

const CATEGORY_COLORS: Record<string, {primary: string; secondary: string; icon: string}> = {
  breaches: {primary: '#7f1d1d', secondary: '#991b1b', icon: '🔓'},
  ransomware: {primary: '#78350f', secondary: '#92400e', icon: '💀'},
  'nation-state': {primary: '#1e1b4b', secondary: '#312e81', icon: '🌐'},
  'threat-intelligence': {primary: '#14532d', secondary: '#166534', icon: '🎯'},
  malware: {primary: '#4a1942', secondary: '#6b2162', icon: '🦠'},
  'zero-day': {primary: '#7c2d12', secondary: '#9a3412', icon: '⚡'},
  vulnerabilities: {primary: '#713f12', secondary: '#854d0e', icon: '🛡️'},
  'incident-response': {primary: '#1e3a5f', secondary: '#1e40af', icon: '🚨'},
  tools: {primary: '#064e3b', secondary: '#065f46', icon: '🔧'},
  'cloud-security': {primary: '#0c4a6e', secondary: '#075985', icon: '☁️'},
  'open-source': {primary: '#1a2e05', secondary: '#365314', icon: '📦'},
  'identity-access': {primary: '#3b0764', secondary: '#581c87', icon: '🔑'},
  'iot-ot': {primary: '#1c1917', secondary: '#44403c', icon: '⚙️'},
  cryptography: {primary: '#0f172a', secondary: '#1e293b', icon: '🔐'},
  'ai-security': {primary: '#170b3b', secondary: '#2e1065', icon: '🤖'},
  policy: {primary: '#1a1a2e', secondary: '#16213e', icon: '📜'},
  compliance: {primary: '#1a1a2e', secondary: '#0f3460', icon: '✅'},
  privacy: {primary: '#2d1b2e', secondary: '#4a1942', icon: '👁️'},
  'supply-chain': {primary: '#1a1a0e', secondary: '#3f3f0e', icon: '🔗'},
};

const DEFAULT_CAT = {primary: '#0f172a', secondary: '#1e293b', icon: '📰'};

const ACCENT: Record<BriefingProps['audience'], string> = {
  executive: '#f59e0b',
  soc: '#ef4444',
  engineer: '#06b6d4',
};

function catStyle(categories?: string[]) {
  if (!categories?.length) return DEFAULT_CAT;
  for (const c of categories) if (CATEGORY_COLORS[c]) return CATEGORY_COLORS[c];
  return DEFAULT_CAT;
}

function catLabel(categories?: string[]): string {
  if (!categories?.length) return 'NEWS';
  return (categories[0] || 'news').toUpperCase().replace(/-/g, ' ');
}

export const SegmentScene: React.FC<Props> = ({audience, segment, segmentIndex, totalSegments, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const accent = ACCENT[audience];
  const cat = catStyle(segment.categories);
  const label = catLabel(segment.categories);
  const cards = segment.impact_cards || [];

  // --- animations driven by parent frame ---
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // background
  const bgShift = interpolate(frame, [0, durationInFrames], [0, 40], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bgPulse = interpolate(frame, [0, durationInFrames], [0.3, 0.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // ken burns
  const kbScale = interpolate(frame, [0, durationInFrames], [1, 1.08], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const kbX = interpolate(frame, [0, durationInFrames], [0, -20], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const kbY = interpolate(frame, [0, durationInFrames], [0, -12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // badge
  const badgeIn = spring({frame, fps, config: {damping: 200, mass: 0.8}, durationInFrames: 20});

  // headline
  const hlSpr = spring({frame: frame - 5, fps, config: {damping: 160, mass: 0.9}, durationInFrames: 30});
  const hlX = interpolate(hlSpr, [0, 1], [-60, 0]);
  const hlOpacity = interpolate(frame, [5, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // subtitle
  const subOpacity = interpolate(frame, [18, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // accent line
  const lineW = interpolate(hlSpr, [0, 1], [0, 100]);

  // card stagger: each card fades in 10 frames apart, starting at frame 30
  const cardStart = 30;
  const cardOpacities = cards.map((_, i) => {
    const start = cardStart + i * 10;
    return interpolate(frame, [start, start + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  });
  const cardYs = cards.map((_, i) => {
    const start = cardStart + i * 10;
    const spr = spring({frame: Math.max(0, frame - start), fps, config: {damping: 160, mass: 0.8}, durationInFrames: 25});
    return interpolate(spr, [0, 1], [16, 0]);
  });

  // key points: after all cards
  const kpStart = cardStart + cards.length * 10 + 20;
  const kpOpacities = segment.key_points.map((_, i) => {
    const start = kpStart + i * 10;
    return interpolate(frame, [start, start + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  });

  // progress bar
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const bg = segment.background_image ? staticFile(segment.background_image) : null;

  return (
    <AbsoluteFill style={{opacity: fadeIn * fadeOut}}>
      {/* Background */}
      <AbsoluteFill>
        {bg ? (
          <Img src={bg} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translate3d(${kbX}px, ${kbY}px, 0) scale(${kbScale})`}} />
        ) : (
          <AbsoluteFill
            style={{
              background: `
                radial-gradient(ellipse 1200px 800px at ${20 + bgShift}% ${30 + bgShift * 0.5}%, ${cat.primary}${Math.round(bgPulse * 255).toString(16).padStart(2, '0')} 0%, transparent 70%),
                radial-gradient(ellipse 800px 600px at ${80 - bgShift * 0.5}% ${70 - bgShift * 0.3}%, ${cat.secondary}40 0%, transparent 60%),
                linear-gradient(170deg, #0a0e1a 0%, #0f1729 40%, #0a0e1a 100%)
              `,
            }}
          />
        )}
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,14,26,0.3) 0%, rgba(10,14,26,0.5) 40%, rgba(10,14,26,0.85) 100%)'}} />
      </AbsoluteFill>

      {/* Top bar */}
      <div
        style={{
          position: 'absolute', top: 50, left: 80, right: 80,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          opacity: badgeIn, transform: `translateY(${interpolate(badgeIn, [0, 1], [-10, 0])}px)`,
        }}
      >
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 6,
          backgroundColor: `${cat.primary}cc`, border: `1px solid ${accent}40`,
          fontSize: 15, fontWeight: 700, letterSpacing: 1.5,
          color: '#e5e7eb', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>
          <span style={{fontSize: 16}}>{cat.icon}</span>
          <span>{label}</span>
        </div>
        <div style={{fontSize: 18, fontWeight: 600, color: '#9ca3af', textShadow: '0 1px 4px rgba(0,0,0,0.8)'}}>
          <span style={{color: accent, fontWeight: 800}}>{segmentIndex + 1}</span>
          <span style={{margin: '0 6px', opacity: 0.5}}>/</span>
          <span>{totalSegments}</span>
        </div>
      </div>

      {/* Content — single flex column, vertically centered */}
      <div
        style={{
          position: 'absolute',
          top: 120, left: 80, right: 80, bottom: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}
      >
        {/* Headline */}
        <div style={{
          fontSize: 52, fontWeight: 800, color: '#f9fafb', lineHeight: 1.1, marginBottom: 12,
          transform: `translateX(${hlX}px)`, opacity: hlOpacity,
          textShadow: '0 2px 10px rgba(0,0,0,0.9)',
        }}>
          {segment.headline}
        </div>

        {/* Subtitle */}
        <div style={{
          opacity: subOpacity, fontSize: 24, lineHeight: 1.4,
          color: '#d1d5db', textShadow: '0 1px 6px rgba(0,0,0,0.9)', marginBottom: 8,
        }}>
          {segment.narration}
        </div>

        {/* Accent line */}
        <div style={{width: lineW, height: 3, backgroundColor: accent, marginBottom: 28, borderRadius: 2}} />

        {/* Impact cards — flex row, always in DOM, animated via opacity/transform */}
        {cards.length > 0 && (
          <div style={{display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap'}}>
            {cards.map((card, i) => (
              <div
                key={`card-${card.label}-${i}`}
                style={{
                  opacity: cardOpacities[i],
                  transform: `translateY(${cardYs[i]}px)`,
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '18px 24px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: 6, minWidth: 260, flex: 1,
                }}
              >
                <div style={{
                  fontSize: 14, fontWeight: 800, letterSpacing: 2,
                  color: accent, textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 24, fontWeight: 700, lineHeight: 1.25,
                  color: '#f9fafb', textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Key points — small secondary text */}
        {segment.key_points.length > 0 && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {segment.key_points.map((kp, i) => (
              <div key={`kp-${i}`} style={{display: 'flex', gap: 10, alignItems: 'flex-start', opacity: kpOpacities[i]}}>
                <span style={{display: 'inline-block', width: 4, height: 4, borderRadius: 999, backgroundColor: '#6b7280', marginTop: 8, flexShrink: 0}} />
                <div style={{fontSize: 20, lineHeight: 1.3, color: '#9ca3af', textShadow: '0 1px 4px rgba(0,0,0,0.8)'}}>
                  {kp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: '#1f2937'}}>
        <div style={{width: `${progress}%`, height: '100%', backgroundColor: accent}} />
      </div>

      {/* Branding */}
      <div style={{
        position: 'absolute', bottom: 16, right: 80,
        fontSize: 15, fontWeight: 600, color: '#4b5563', letterSpacing: 1,
        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
      }}>
        THREATNOIR
      </div>
    </AbsoluteFill>
  );
};
