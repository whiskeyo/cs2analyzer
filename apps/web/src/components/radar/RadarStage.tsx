import { useState } from "react";
import { SnapshotDialog } from "@/components/playbook/SnapshotDialog";
import { tickRate } from "@/lib/shared/constants";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { makeBookmarkStroke } from "@/lib/notes";
import { currentRound } from "@/lib/replay/sample";
import { useApp } from "@/lib/state/appState";
import { Hud } from "./Hud";
import { KillFeed } from "./KillFeed";
import { MapToolbar } from "./MapToolbar";
import { NadeLegend } from "./NadeLegend";
import { RadarCanvas } from "./RadarCanvas";
import { SpectatorEconomy } from "./SpectatorEconomy";

/**
 * Wires the radar column to the app stores. `RadarCanvas` and the overlays stay
 * prop-driven so they can be rendered without a provider.
 */
export function RadarStage() {
  const { session, playback, review, view, cal, habits } = useApp();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const replay = session.replay;
  if (!replay) return null;
  const { tick } = playback;
  const habitsOnly = habits.overlay != null;

  return (
    <div className="radar-col">
      <MapToolbar
        review={{
          tool: view.tool,
          color: review.color,
          paletteId: review.paletteId,
          floorMode: review.floorMode,
          hasFloors: Boolean(cal?.lower_radar),
          canUndo: review.canUndo,
          canRedo: review.canRedo,
        }}
        view={{
          follow: view.follow,
          trails: view.trails,
          moment: view.moment,
          canFollow: view.selected != null,
          layers: view.layers,
        }}
        reviewActions={{
          onTool: view.setTool,
          onColor: review.setColor,
          onPalette: (id) => {
            review.setPaletteId(id);
            const preset = COLOR_PRESETS.find((p) => p.id === id);
            if (preset && !(preset.colors as readonly string[]).includes(review.color)) {
              review.setColor(preset.colors[0]);
            }
          },
          onFloorMode: review.setFloorMode,
          onUndo: review.undo,
          onRedo: review.redo,
          onClear: () => {
            const round = currentRound(replay, tick)?.number;
            review.commitStrokes(
              round == null
                ? []
                : review.strokes.filter((st) => st.round !== round || st.type === "bookmark"),
            );
          },
          onStampBookmark: () => {
            const round = currentRound(replay, tick);
            if (!round) {
              return;
            }
            review.commitStrokes([
              ...review.strokes,
              makeBookmarkStroke(
                review.color,
                round.number,
                tick,
                view.moment,
                round.end_tick,
                tickRate(replay),
              ),
            ]);
          },
        }}
        viewActions={{
          onFollow: view.setFollow,
          onTrails: view.setTrails,
          onMoment: view.setMoment,
          onLayers: (next) => {
            if (next.summary && !view.layers.summary) {
              playback.setPlaying(false);
            }
            view.setLayers(next);
          },
          onResetView: view.resetView,
        }}
        onSnapshot={habitsOnly ? undefined : () => setSnapshotOpen(true)}
      />
      <div className="radar-stage">
        <RadarCanvas
          replay={replay}
          tick={tick}
          cal={cal}
          selected={view.selected}
          onSelect={view.select}
          follow={view.follow}
          trails={view.trails}
          tool={view.tool}
          color={review.color}
          strokes={review.strokes}
          onStrokes={(next) => review.commitStrokes(next)}
          onPan={() => view.setFollow(false)}
          onPause={() => playback.setPlaying(false)}
          moment={view.moment}
          layers={view.layers}
          summaryFilter={review.summaryFilter}
          viewEpoch={view.viewEpoch}
          floorMode={review.floorMode}
          habitsOverlay={habits.overlay}
          habitsOverlayDisplay={habits.overlayDisplay}
          habitsShowTrails={habits.overlayTrails}
          habitsShowArrows={habits.overlayArrows}
          habitsNadeFilter={habits.nadeFilter}
          habitsNadesOn={habits.nadesOn}
          habitsNadeOpacity={habits.nadeOpacity}
          habitsPlaySecRef={habitsOnly ? habits.bucketPlaySecRef : undefined}
          habitsOnly={habitsOnly}
          onHabitsJump={habits.playRound}
        />
        {!habitsOnly && <Hud replay={replay} tick={tick} />}
        {view.layers.summary && (
          <NadeLegend filter={review.summaryFilter} onFilter={review.setSummaryFilter} />
        )}
        {!habitsOnly && (
          <SpectatorEconomy
            replay={replay}
            tick={tick}
            selected={view.selected}
            onSelect={view.select}
          />
        )}
        {!habitsOnly && <KillFeed replay={replay} tick={tick} onJump={playback.jump} />}
      </div>
      {snapshotOpen ? (
        <SnapshotDialog
          mapName={replay.header.map_name}
          replay={replay}
          tick={tick}
          fileName={session.fileName}
          floor={review.floorMode}
          cal={cal}
          onClose={() => setSnapshotOpen(false)}
        />
      ) : null}
    </div>
  );
}
