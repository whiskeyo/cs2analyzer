import { Controls } from "@/components/playback/Controls";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { SeriesAggregatedRoundStrip } from "@/components/playback/SeriesAggregatedRoundStrip";
import { BucketControls } from "@/components/playback/BucketControls";
import { RadarStage } from "@/components/radar/RadarStage";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useMessages } from "@/lib/i18n";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView, isBucketOverlayActive } from "@/lib/parse/seriesMode";
import { SeriesBar } from "./SeriesBar";
import { SeriesFilters } from "./SeriesFilters";

export function Viewer() {
  const { messages } = useMessages();
  const { session, playback, review, places, habits } = useApp();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);
  const bucketMode = replay != null && isBucketOverlayActive(session.series, habits);

  if (!replay) return null;
  const { tick } = playback;
  const switching = session.switching;

  return (
    <>
      <SeriesBar />
      <SeriesFilters />
      <div className="viewer-body">
        {switching ? (
          <div className="series-switch-pane" aria-live="polite">
            <p className="series-switch-wait">{messages.analyzer.switching}</p>
          </div>
        ) : (
          <>
            <main className="stage">
              <RadarStage />
              <Sidebar />
            </main>
            {!aggregated ? (
              <RoundStrip
                replay={replay}
                tick={tick}
                notes={review.notes}
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
                notes={review.notes}
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
      <p className="keys">{messages.analyzer.hotkeys}</p>
    </>
  );
}
