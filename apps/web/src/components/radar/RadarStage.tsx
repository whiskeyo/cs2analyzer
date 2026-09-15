import { useState } from "react";
import { SnapshotDialog } from "@/components/playbook/SnapshotDialog";
import { SnapshotToast, type SnapshotToastInfo } from "@/components/playbook/SnapshotToast";
import {
  addBookmark,
  clearRoundDrawings,
  makeBookmark,
  noteForRound,
  updateRoundNote,
} from "@/lib/notes";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { snapshotFromAnalyzer } from "@/lib/playbook/snapshot";
import { analyzerPawnLegend } from "@/lib/radar/pawnLegend";
import { currentRound } from "@/lib/replay/sample";
import { tickRate } from "@/lib/shared/constants";
import { useApp } from "@/lib/state/appState";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { Hud } from "./Hud";
import { KillFeed } from "./KillFeed";
import { MapToolbar } from "./MapToolbar";
import { NadeLegend } from "./NadeLegend";
import { PawnLegend } from "./PawnLegend";
import { RadarCanvas } from "./RadarCanvas";
import { SpectatorEconomy } from "./SpectatorEconomy";

/**
 * Wires the radar column to the app stores. `RadarCanvas` and the overlays stay
 * prop-driven so they can be rendered without a provider.
 */
export function RadarStage() {
  const { session, playback, review, view, cal, habits } = useApp();
  const { settings } = useUserSettings();
  const [snapshot, setSnapshot] = useState<ReturnType<typeof snapshotFromAnalyzer> | null>(null);
  const [toast, setToast] = useState<SnapshotToastInfo | null>(null);
  const replay = session.replay;
  if (!replay) return null;
  const { tick } = playback;
  const habitsOnly = habits.overlay != null;
  const pawnLegend = analyzerPawnLegend(session.series, habits, habits.overlay);

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
            if (round == null) {
              review.commitNotes([]);
              return;
            }
            review.commitNotes(updateRoundNote(review.notes, round, clearRoundDrawings));
          },
          onStampBookmark: () => {
            const round = currentRound(replay, tick);
            if (!round) {
              return;
            }
            review.commitNotes(
              updateRoundNote(review.notes, round.number, (note) =>
                addBookmark(
                  note,
                  makeBookmark(
                    review.color,
                    tick,
                    view.moment,
                    round.end_tick,
                    tickRate(replay),
                    settings.noteMomentSec,
                  ),
                ),
              ),
            );
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
        onSnapshot={() =>
          setSnapshot(
            snapshotFromAnalyzer({
              replay,
              tick,
              fileName: session.fileName,
              floor: review.floorMode,
              cal,
              mapName: replay.header.map_name,
              overlay: habits.overlay,
              playSec: habits.bucketPlaySec,
              nadeFilter: habits.nadeFilter,
              nadesOn: habits.nadesOn,
              series: session.series,
              bucket: habits.bucketOverlay,
              layers: view.layers,
              summaryFilter: review.summaryFilter,
              selected: view.selected,
              trails: view.trails,
              note: noteForRound(review.notes, currentRound(replay, tick)?.number ?? 0),
            }),
          )
        }
      />
      <div className="radar-stage">
        <RadarCanvas
          replay={replay}
          tick={tick}
          tickRef={playback.tickRef}
          cal={cal}
          selected={view.selected}
          onSelect={view.select}
          follow={view.follow}
          trails={view.trails}
          tool={view.tool}
          color={review.color}
          note={noteForRound(review.notes, currentRound(replay, tick)?.number ?? 0)}
          onNote={(next) => {
            const round = currentRound(replay, tick)?.number ?? 0;
            review.commitNotes(updateRoundNote(review.notes, round, () => next));
          }}
          onPan={() => view.setFollow(false)}
          onPause={() => playback.setPlaying(false)}
          moment={view.moment}
          momentSec={settings.noteMomentSec}
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
          radarGray={settings.radarGray}
        />
        <PawnLegend entries={pawnLegend} />
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
        {toast ? <SnapshotToast {...toast} onDismiss={() => setToast(null)} /> : null}
      </div>
      {snapshot ? (
        <SnapshotDialog
          mapName={snapshot.mapName}
          pieces={snapshot.pieces}
          groups={snapshot.groups}
          drawings={snapshot.drawings}
          radarFx={snapshot.radarFx}
          stratTitle={snapshot.stratTitle}
          floor={snapshot.floor}
          onClose={() => setSnapshot(null)}
          onSaved={(saved) => {
            setSnapshot(null);
            setToast(saved);
          }}
        />
      ) : null}
    </div>
  );
}
