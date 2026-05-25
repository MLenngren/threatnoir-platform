import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

export const DividerScene: React.FC<{index: number; total: number}> = ({index, total}) => {
  const frame = useCurrentFrame();
  const lineW = interpolate(frame, [0, 22], [0, 900], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const textOpacity = interpolate(frame, [8, 18, 34, 44], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0e1a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div style={{width: lineW, height: 2, backgroundColor: '#f59e0b'}} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: textOpacity,
          color: '#f9fafb',
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 0.5,
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}
      >
        {index} of {total}
      </div>
    </AbsoluteFill>
  );
};
