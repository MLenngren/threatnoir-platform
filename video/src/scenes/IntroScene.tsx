import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {BriefingProps} from '../schema';

const accentByAudience: Record<BriefingProps['audience'], string> = {
  executive: '#f59e0b',
  soc: '#ef4444',
  engineer: '#06b6d4',
};

export const IntroScene: React.FC<Pick<BriefingProps, 'audience' | 'date' | 'title' | 'intro'>> = ({
  audience,
  date,
  title,
  intro,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logoIn = spring({
    frame,
    fps,
    config: {damping: 140, mass: 0.9},
    durationInFrames: 45,
  });

  const dateIn = spring({
    frame: frame - 30,
    fps,
    config: {damping: 160, mass: 0.9},
    durationInFrames: 30,
  });

  const audienceOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgShift = interpolate(frame, [0, fps * 4], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundImage: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
        backgroundSize: '200% 200%',
        backgroundPosition: `${bgShift}% ${100 - bgShift}%`,
        padding: 80,
        justifyContent: 'flex-end',
      }}
    >
      <div style={{maxWidth: 1200}}>
        <div
          style={{
            opacity: logoIn,
            transform: `scale(${interpolate(logoIn, [0, 1], [0.96, 1])})`,
            transformOrigin: 'left bottom',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: -1,
              color: '#f9fafb',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            ThreatNoir
          </div>
          <div style={{fontSize: 28, color: '#d1d5db', marginTop: 10}}>{intro.text}</div>
        </div>

        <div
          style={{
            opacity: dateIn,
            transform: `translateY(${interpolate(dateIn, [0, 1], [26, 0])}px)`,
            marginBottom: 18,
          }}
        >
          <div style={{fontSize: 42, fontWeight: 700, color: '#f9fafb'}}>{title}</div>
          <div style={{fontSize: 26, color: '#d1d5db', marginTop: 8}}>{date}</div>
        </div>

        <div
          style={{
            opacity: audienceOpacity,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 999,
            border: `1px solid ${accentByAudience[audience]}55`,
            backgroundColor: '#0b1220aa',
            color: '#f9fafb',
            fontSize: 18,
            fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          <span style={{width: 10, height: 10, borderRadius: 999, backgroundColor: accentByAudience[audience]}} />
          <span style={{textTransform: 'uppercase', letterSpacing: 1}}>{audience} briefing</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
