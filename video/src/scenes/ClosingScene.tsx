import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const ClosingScene: React.FC<{closingText: string; totalSegments: number}> = ({closingText, totalSegments}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const duration = Math.round(3.5 * fps);
  const tagIn = spring({frame, fps, config: {damping: 160, mass: 0.9}, durationInFrames: 40});
  const fadeOut = interpolate(frame, [duration - 30, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

	const url = 'example.com';
  const chars = Math.round(
    interpolate(frame, [20, 70], [0, url.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
  );
  const cursorOpacity = chars >= url.length ? 0 : interpolate(frame % 20, [0, 10], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        backgroundImage: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
        padding: 80,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{textAlign: 'center', opacity: fadeOut, maxWidth: 1200}}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#f9fafb',
            textShadow: '0 2px 10px rgba(0,0,0,0.85)',
            opacity: tagIn,
            transform: `translateY(${interpolate(tagIn, [0, 1], [12, 0])}px)`,
          }}
        >
          Stay Vigilant
        </div>

        <div style={{marginTop: 18, fontSize: 28, color: '#d1d5db', textShadow: '0 2px 8px rgba(0,0,0,0.8)'}}>
          {closingText}
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 1,
            color: '#f59e0b',
            textShadow: '0 2px 10px rgba(0,0,0,0.85)',
          }}
        >
          {url.slice(0, chars)}
          <span style={{opacity: cursorOpacity}}>{'▍'}</span>
        </div>

        <div style={{marginTop: 18, fontSize: 22, color: '#d1d5db', opacity: 0.9}}>
          Covering <span style={{color: '#f9fafb', fontWeight: 800}}>{totalSegments}</span> security stories
        </div>
      </div>
    </AbsoluteFill>
  );
};
