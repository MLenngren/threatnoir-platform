import React from 'react';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import type {BriefingProps} from './schema';
import {IntroScene} from './scenes/IntroScene';
import {SegmentScene} from './scenes/SegmentScene';
import {DividerScene} from './scenes/DividerScene';
import {ClosingScene} from './scenes/ClosingScene';

const TRANSITION_FRAMES = 15; // 0.5s at 30fps
const INTRO_SECONDS = 3.5;
const CLOSING_SECONDS = 3.5;
const DIVIDER_SECONDS = 1.5;

export const calculateBriefingMetadata: CalculateMetadataFunction<BriefingProps> = async ({props}) => {
  const fps = 30;
  const intro = Math.round(INTRO_SECONDS * fps);
  const closing = Math.round(CLOSING_SECONDS * fps);
  const divider = Math.round(DIVIDER_SECONDS * fps);
  const segments = props.segments.map((s) => Math.max(1, Math.round(s.display_seconds * fps)));

  const totalScenes = 1 + props.segments.length + Math.max(0, props.segments.length - 1) + 1;
  const totalTransitions = Math.max(0, totalScenes - 1);

  const baseDuration =
    intro +
    closing +
    segments.reduce((a, b) => a + b, 0) +
    divider * Math.max(0, props.segments.length - 1);

  const durationInFrames = Math.max(1, baseDuration - totalTransitions * TRANSITION_FRAMES);

  return {
    durationInFrames,
    props,
  };
};

export const BriefingComposition: React.FC<BriefingProps> = (props) => {
  const fps = 30;
  const introFrames = Math.round(INTRO_SECONDS * fps);
  const closingFrames = Math.round(CLOSING_SECONDS * fps);
  const dividerFrames = Math.round(DIVIDER_SECONDS * fps);

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0e1a'}}>
      <Audio src={staticFile('bgm.mp3')} volume={0.12} loop />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={introFrames}>
          <IntroScene audience={props.audience} date={props.date} title={props.title} intro={props.intro} />
        </TransitionSeries.Sequence>

        {props.segments.map((segment, i) => {
          const segmentFrames = Math.max(1, Math.round(segment.display_seconds * fps));
          const isLast = i === props.segments.length - 1;

          return (
            <React.Fragment key={`${segment.headline}-${i}`}>
              <TransitionSeries.Transition timing={linearTiming({durationInFrames: TRANSITION_FRAMES})} presentation={fade()} />
              <TransitionSeries.Sequence durationInFrames={segmentFrames}>
                <SegmentScene
                  audience={props.audience}
                  segment={segment}
                  segmentIndex={i}
                  totalSegments={props.segments.length}
                  durationInFrames={segmentFrames}
                />
              </TransitionSeries.Sequence>

              {!isLast ? (
                <>
                  <TransitionSeries.Transition
                    timing={linearTiming({durationInFrames: TRANSITION_FRAMES})}
                    presentation={fade()}
                  />
                  <TransitionSeries.Sequence durationInFrames={dividerFrames}>
                    <DividerScene index={i + 2} total={props.segments.length} />
                  </TransitionSeries.Sequence>
                </>
              ) : null}
            </React.Fragment>
          );
        })}

        <TransitionSeries.Transition timing={linearTiming({durationInFrames: TRANSITION_FRAMES})} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={closingFrames}>
          <ClosingScene closingText={props.closing.text} totalSegments={props.segments.length} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
