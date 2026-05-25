import React from 'react';
import {Composition} from 'remotion';
import {BriefingComposition, calculateBriefingMetadata} from './BriefingComposition';
import {BriefingSchema} from './schema';
import type {BriefingProps} from './schema';

const defaultProps: BriefingProps = {
  audience: 'executive',
  date: '2026-03-15',
  title: 'Daily Security Briefing',
  intro: {
    text: 'Fast, curated cyber risk highlights',
  },
  segments: [
    {
      headline: 'Ransomware crew targets EU healthcare networks',
      narration: 'A coordinated campaign disrupted clinical operations across multiple countries.',
      key_points: ['Phishing initial access + lateral movement', 'Data theft extortion pressure rising', 'Patch exposed VPN gateways immediately'],
      display_seconds: 10,
    },
    {
      headline: 'High-severity bug found in widely used SSO library',
      narration: 'A parsing flaw enables token validation bypass in certain configurations.',
      key_points: ['Affects older versions with legacy parsing mode', 'Exploitability depends on issuer checks', 'Upgrade and add explicit audience validation'],
      display_seconds: 11,
    },
    {
      headline: 'Supply-chain alert: malicious package steals cloud creds',
      narration: 'Attackers published lookalike modules to exfiltrate environment variables.',
      key_points: ['Typosquatting targets CI runners', 'Secrets leaked via outbound DNS', 'Pin dependencies and enable egress allowlists'],
      display_seconds: 11,
    }
  ],
  closing: {
    text: 'Thanks for watching — see full coverage in ThreatNoir.',
  },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BriefingComposition"
        component={BriefingComposition}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={1}
        schema={BriefingSchema}
        defaultProps={defaultProps}
        calculateMetadata={calculateBriefingMetadata}
      />
    </>
  );
};
