import { useRef, useState } from "react";
import { Controls } from "@/components/playback/Controls";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { SeriesAggregatedRoundStrip } from "@/components/playback/SeriesAggregatedRoundStrip";
import { BucketControls } from "@/components/playback/BucketControls";
import { RadarStage } from "@/components/radar/RadarStage";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ParseProgressPanel } from "@/components/app/ParseProgressPanel";
import { useApp } from "@/lib/state/appState";
import { prefetchParser } from "@/lib/parse/ensureParser";
import { takeDroppedDemoFiles } from "@/lib/parse/demoDrop";
import { notesForAnalyzerSession } from "@/lib/notes";
import { isAggregatedView, isBucketOverlayActive } from "@/lib/parse/seriesMode";
import {
  isTutorialSeriesBucketEnabled,
  isTutorialSeriesChipEnabled,
  isTutorialSeriesRoundEnabled,
} from "@/lib/tutorial/activeRound";
import { SeriesBar } from "./SeriesBar";
import { SeriesFilters } from "./SeriesFilters";

function parseOverallPct(progress: { current: number; total: number } | null): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((100 * progress.current) / progress.total));
}

export function Viewer() {
  const { session, playback, review, places, habits, appendFiles, status } = useApp();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);
  const bucketMode = replay != null && isBucketOverlayActive(session.series, habits);
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  if (!replay) return null;
  const { tick } = playback;
  const switching = session.switching;
  const chromeNotes = notesForAnalyzerSession(review.notes, {
    aggregated,
    notesDemoId: review.notesDemoId ?? null,
    boardDemoId: session.demo?.id ?? null,
  });

  return (
    <div
      className={`viewer${dragOver ? " is-drop-target" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        prefetchParser();
        dragDepthRef.current += 1;
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepthRef.current -= 1;
        if (dragDepthRef.current <= 0) {
          dragDepthRef.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        dragDepthRef.current = 0;
        setDragOver(false);
        void takeDroppedDemoFiles(e, appendFiles);
      }}
    >
      {session.parsing ? (
        <div className="viewer-parse">
          <ParseProgressPanel
            overallPct={parseOverallPct(session.progress)}
            files={session.parseFiles}
            onCancel={session.cancelParse}
          />
        </div>
      ) : null}
      {status?.notice && !session.parsing ? (
        <p className="notice viewer-status">{status.notice}</p>
      ) : null}
      {dragOver ? (
        <p className="viewer-drop-hint" aria-live="polite">
          Drop to add this demo to the open session
        </p>
      ) : null}
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
              <Sidebar />
            </main>
            {!aggregated ? (
              <RoundStrip
                replay={replay}
                tick={tick}
                notes={chromeNotes}
                places={places}
                activeRound={playback.activeRound}
                roundEnabled={() => isTutorialSeriesRoundEnabled(session.demo?.id)}
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
                bucketEnabled={(kind) => isTutorialSeriesBucketEnabled(session.demo?.id, kind)}
                roundJumpEnabled={isTutorialSeriesChipEnabled(session.demo?.id)}
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
                notes={chromeNotes}
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
