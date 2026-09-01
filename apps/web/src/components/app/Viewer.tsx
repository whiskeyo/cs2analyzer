import { useEffect, useRef } from "react";
import { Controls } from "@/components/playback/Controls";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { SeriesAggregatedRoundStrip } from "@/components/playback/SeriesAggregatedRoundStrip";
import { BucketControls } from "@/components/playback/BucketControls";
import { RadarStage } from "@/components/radar/RadarStage";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView, isBucketOverlayActive } from "@/lib/parse/seriesMode";
import { ViewerHeader } from "./ViewerHeader";
import { SeriesBar } from "./SeriesBar";
import { SeriesFilters } from "./SeriesFilters";

export function Viewer() {
  const { session, playback, review, view, places, habits } = useApp();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);
  const bucketMode = replay != null && isBucketOverlayActive(session.series, habits);
  const bucketPlayingRef = useRef(playback.playing);
  bucketPlayingRef.current = bucketMode ? playback.playing : false;

  useEffect(() => {
    if (!bucketMode || !playback.playing) return;
    let last = performance.now();
    let lastUi = last;
    let id = 0;
    const maxSec = habits.bucketWindowSec;
    const playRef = habits.bucketPlaySecRef;
    const setPlaySec = habits.setBucketPlaySec;
    const loop = (now: number) => {
      if (!bucketPlayingRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      const next = Math.min(maxSec, playRef.current + dt * playback.speed);
      playRef.current = next;
      if (next >= maxSec) {
        playback.setPlaying(false);
        setPlaySec(next);
      } else if (now - lastUi >= 100) {
        lastUi = now;
        setPlaySec(next);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      if (bucketPlayingRef.current === false && bucketMode) {
        setPlaySec(playRef.current);
      }
    };
  }, [
    bucketMode,
    playback.playing,
    playback.speed,
    playback.setPlaying,
    habits.bucketWindowSec,
    habits.bucketPlaySecRef,
    habits.setBucketPlaySec,
  ]);

  if (!replay) return null;
  const { tick, jump } = playback;
  const switching = session.switching;

  return (
    <div className="app">
      <ViewerHeader />
      <SeriesBar />
      <SeriesFilters />
      <div className="viewer-body">
        {switching ? (
          <div className="series-switch-pane" aria-live="polite">
            <p className="series-switch-wait">Switching demo…</p>
          </div>
        ) : (
          <>
            <main className="stage">
              <RadarStage />
              <Sidebar
                replay={replay}
                tick={tick}
                strokes={review.strokes}
                selected={view.selected}
                onSelect={view.select}
                onJump={jump}
                onStrokes={review.commitStrokes}
                places={places}
                activeRound={playback.activeRound}
              />
            </main>
            {!aggregated ? (
              <RoundStrip
                replay={replay}
                tick={tick}
                strokes={review.strokes}
                places={places}
                activeRound={playback.activeRound}
              />
            ) : (
              <SeriesAggregatedRoundStrip
                groups={habits.seriesRoundsByKind}
                demoColors={habits.demoColors}
                activeDemoId={session.demo?.id ?? null}
                bucketOverlay={habits.bucketOverlay}
                replay={replay}
                tick={tick}
                onBucketOverlay={habits.selectBucketOverlay}
                onRoundJump={habits.playRound}
              />
            )}
            {bucketMode ? (
              <BucketControls
                playSec={habits.bucketPlaySec}
                maxSec={habits.bucketWindowSec}
                playing={playback.playing}
                speed={playback.speed}
                onPlaySec={habits.setBucketPlaySec}
                onPlaying={playback.setPlaying}
                onTogglePlay={playback.togglePlaying}
                onSpeed={playback.setSpeed}
              />
            ) : (
              <Controls
                replay={replay}
                tick={tick}
                strokes={review.strokes}
                playing={playback.playing}
                speed={playback.speed}
                roundAutoplay={playback.roundAutoplay}
                onTick={playback.scrub}
                onJump={playback.jump}
                onTogglePlay={playback.togglePlaying}
                onPlaying={playback.setPlaying}
                onSpeed={playback.setSpeed}
                onRoundAutoplay={playback.setRoundAutoplay}
                activeRound={playback.activeRound}
              />
            )}
          </>
        )}
      </div>
      <p className="keys">
        Space play · ←/→ scrub · [ ] rounds · e E executes · , . kills · F track · T trail · Ctrl+Z
        undo · Esc deselect
      </p>
    </div>
  );
}
