import { memo, useMemo } from "react";
import { bucketTimelineMarks, markLabelShift } from "@/lib/playback/roundTimeline";
import { formatClock } from "@/lib/weapons/weapons";
import { TransportButton } from "./TransportButton";
import { UnfocusableButton } from "./UnfocusableButton";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

interface Props {
  playSec: number;
  maxSec: number;
  playing: boolean;
  speed: number;
  onPlaySec: (sec: number) => void;
  onPlaying: (v: boolean) => void;
  onTogglePlay: () => void;
  onSpeed: (v: number) => void;
}

/** Scrub/playhead for aggregated bucket overlay (freeze-relative seconds). */
export const BucketControls = memo(function BucketControls({
  playSec,
  maxSec,
  playing,
  speed,
  onPlaySec,
  onPlaying,
  onTogglePlay,
  onSpeed,
}: Props) {
  const span = Math.max(maxSec, 0.001);
  const progress = Math.min(1, Math.max(0, playSec / span));
  const marks = useMemo(() => bucketTimelineMarks(maxSec), [maxSec]);

  const step = (dir: number) => {
    onPlaySec(Math.min(maxSec, Math.max(0, playSec + dir)));
    onPlaying(false);
  };

  return (
    <div className="controls">
      <TransportButton playing={playing} onToggle={onTogglePlay} />
      <UnfocusableButton title="Step back 1s" onClick={() => step(-1)}>
        −
      </UnfocusableButton>
      <UnfocusableButton title="Step forward 1s" onClick={() => step(1)}>
        +
      </UnfocusableButton>
      <label className="speed">
        Speed
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      <div className="timeline-wrap">
        <div className="timeline-bar">
          <div className="timeline-track" aria-hidden="true" />
          <div
            className="timeline-playhead"
            style={{ left: `${progress * 100}%` }}
            aria-hidden="true"
          />
          <div className="timeline-marks" aria-hidden="true">
            {marks.map((m) => (
              <span key={m.sec} className="timeline-tick" style={{ left: `${m.at * 100}%` }} />
            ))}
          </div>
          <input
            className="timeline"
            type="range"
            min={0}
            max={maxSec}
            step={0.1}
            aria-label="Bucket overlay timeline"
            value={playSec}
            onChange={(e) => onPlaySec(Number(e.target.value))}
          />
        </div>
        <div className="timeline-labels" aria-hidden="true">
          {marks.map((m) => (
            <span
              key={m.sec}
              className="timeline-label"
              style={{
                left: `${m.at * 100}%`,
                transform: `translateX(${markLabelShift(m.at)})`,
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
      <span className="clock">+{formatClock(playSec)}</span>
    </div>
  );
});
