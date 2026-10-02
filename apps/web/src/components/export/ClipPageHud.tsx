import { memo } from "react";
import { Hud } from "@/components/radar/Hud";
import { SpectatorEconomy } from "@/components/radar/SpectatorEconomy";
import { Scoreboard } from "@/components/sidebar/Scoreboard";
import {
  CLIP_HUD_PANEL_ECO,
  CLIP_HUD_PANEL_HUD,
  CLIP_HUD_PANEL_SCORE,
  clipPageStage,
} from "@/lib/export/clipPageHudKey";
import type { Replay } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  width: number;
  height: number;
}

/**
 * The analyzer HUD, spectator cards, and scoreboard at the clip frame size.
 * `tick` is the export frame, not the live playback clock.
 */
export const ClipPageHud = memo(function ClipPageHud({
  replay,
  tick,
  selected,
  width,
  height,
}: Props) {
  const stage = clipPageStage(width, height);
  return (
    <div className="clip-page-host" style={{ width, height }}>
      <div className="radar-stage clip-page-stage" style={{ width: stage.width, height }}>
        <div className="clip-page-hud-panel" data-clip-panel={CLIP_HUD_PANEL_HUD}>
          <Hud replay={replay} tick={tick} />
        </div>
        <div className="clip-page-eco-panel" data-clip-panel={CLIP_HUD_PANEL_ECO}>
          <SpectatorEconomy
            replay={replay}
            tick={tick}
            selected={selected}
            onSelect={() => undefined}
          />
        </div>
      </div>
      <aside
        className="sidebar clip-page-score"
        style={{ width: stage.sidebar }}
        data-clip-panel={CLIP_HUD_PANEL_SCORE}
      >
        <div className="tabs">
          <button type="button" className="on" tabIndex={-1}>
            Score
          </button>
        </div>
        <div className="sidebar-body">
          <Scoreboard replay={replay} tick={tick} selected={selected} onSelect={() => undefined} />
        </div>
      </aside>
    </div>
  );
});
