import { Controls } from "@/components/playback/Controls";
import { RadarStage } from "@/components/radar/RadarStage";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useApp } from "@/lib/state/appState";
import { ViewerHeader } from "./ViewerHeader";

export function Viewer() {
  const { session, playback, review, view, places } = useApp();
  const replay = session.replay;
  if (!replay) return null;
  const { tick, jump } = playback;

  return (
    <div className="app">
      <ViewerHeader />
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
      <RoundStrip
        replay={replay}
        tick={tick}
        strokes={review.strokes}
        onJump={jump}
        places={places}
      />
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
      <p className="keys">
        Space play · ←/→ scrub · [ ] rounds · e E executes · , . kills · F track · T trail · Ctrl+Z
        undo · Esc deselect
      </p>
    </div>
  );
}
