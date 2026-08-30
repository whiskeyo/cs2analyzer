import { Controls } from "@/components/playback/Controls";
import { RadarStage } from "@/components/radar/RadarStage";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { SeriesAggregatedRoundStrip } from "@/components/playback/SeriesAggregatedRoundStrip";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useApp } from "@/lib/state/appState";
import { ViewerHeader } from "./ViewerHeader";
import { SeriesBar } from "./SeriesBar";
import { SeriesFilters } from "./SeriesFilters";

export function Viewer() {
  const { session, playback, review, view, places, habits } = useApp();
  const replay = session.replay;
  if (!replay) return null;
  const { tick, jump } = playback;
  const switching = session.switching;
  const aggregated = habits.aggregated && session.series != null && session.series.demos.length > 1;

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
              />
            </main>
            {!aggregated ? (
              <RoundStrip
                replay={replay}
                tick={tick}
                strokes={review.strokes}
                onJump={jump}
                places={places}
              />
            ) : (
              <SeriesAggregatedRoundStrip
                groups={habits.seriesRoundsByKind}
                demoColors={habits.demoColors}
                activeDemoId={session.demo?.id ?? null}
                replay={replay}
                tick={tick}
                onJump={habits.jumpHabits}
              />
            )}
            <Controls
              replay={replay}
              tick={tick}
              strokes={review.strokes}
              playing={playback.playing}
              speed={playback.speed}
              onTick={playback.scrub}
              onPlaying={playback.setPlaying}
              onSpeed={playback.setSpeed}
            />
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
