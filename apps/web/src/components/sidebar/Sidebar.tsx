import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "@/lib/shared/constants";
import { useApp } from "@/lib/state/appState";
import { Action } from "./Action";
import { Clutch } from "./Clutch";
import { Review } from "./Review";
import { Notes } from "./Notes";
import { RoundList } from "./RoundList";
import { Scoreboard } from "./Scoreboard";
import { clampSidebarWidth, loadSidebarWidth, saveSidebarWidth } from "@/lib/shared/sidebarWidth";
import { computeStats, weaponBreakdown } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import type { MapPlaces } from "@/lib/match/sites";
import type { Stroke } from "@/lib/notes/types";
import { Utility } from "./Utility";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { SeriesBucketPanel } from "./SeriesBucketPanel";
import { SeriesUtilList } from "./SeriesUtilList";
import { SeriesActionList } from "./SeriesActionList";
import { SeriesPlayerReview } from "./SeriesPlayerReview";
import { seriesPlayerReview } from "@/lib/parse/seriesPlayerReview";

type Tab = "score" | "player" | "notes" | "action" | "util" | "clutch" | "rounds" | "weapons";

const DEMO_ONLY_TABS: Tab[] = ["score", "notes", "clutch", "rounds", "weapons"];

const TAB_LABEL: Record<Tab, string> = {
  score: "Score",
  player: "Review",
  notes: "Notes",
  action: "Action",
  util: "Util",
  clutch: "Clutch",
  rounds: "Rounds",
  weapons: "Weapons",
};

interface Props {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onJump: (tick: number) => void;
  onStrokes: (next: Stroke[]) => void;
  places: MapPlaces | null;
}

export const Sidebar = memo(function Sidebar({
  replay,
  tick,
  strokes,
  selected,
  onSelect,
  onJump,
  onStrokes,
  places,
}: Props) {
  const { session, habits } = useApp();
  const multiDemo = Boolean(session.series && session.series.demos.length > 1);
  const seriesMode = multiDemo && habits.aggregated;
  const playerKey = habits.playerKey;
  const playerName = playerKey
    ? (habits.focalPlayers.find((p) => p.key === playerKey)?.name ?? null)
    : null;
  const showSeriesUtil = multiDemo && (seriesMode || playerKey != null);
  const showSeriesAction = seriesMode;
  const showSeriesReview = multiDemo && playerKey != null;
  const tabDisabled = (id: Tab) => seriesMode && DEMO_ONLY_TABS.includes(id);
  const seriesReview = useMemo(() => {
    if (!showSeriesReview || !session.series || !playerKey || !playerName) return null;
    return seriesPlayerReview(session.series, playerKey, playerName);
  }, [showSeriesReview, session.series, playerKey, playerName]);

  const [tab, setTab] = useState<Tab>("score");
  const activeTab: Tab = seriesMode && DEMO_ONLY_TABS.includes(tab) ? "action" : tab;
  const [width, setWidth] = useState(loadSidebarWidth);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const fit = () => {
      const stage = document.querySelector(".stage");
      const stageWidth = stage instanceof HTMLElement ? stage.clientWidth : window.innerWidth;
      setWidth((w) => clampSidebarWidth(w, stageWidth));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.body.classList.remove("sidebar-resizing");
    };
  }, []);

  const stageWidthOf = (el: HTMLElement) => {
    const stage = el.closest(".stage");
    return stage instanceof HTMLElement ? stage.clientWidth : window.innerWidth;
  };

  const onResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: widthRef.current };
    document.body.classList.add("sidebar-resizing");
  };

  const onResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = clampSidebarWidth(
      drag.startWidth + (drag.startX - e.clientX),
      stageWidthOf(e.currentTarget),
    );
    setWidth(next);
  };

  const endResize = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    document.body.classList.remove("sidebar-resizing");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    saveSidebarWidth(widthRef.current);
  };

  const onResizeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    let raw: number;
    if (e.key === "ArrowLeft") raw = widthRef.current + step;
    else if (e.key === "ArrowRight") raw = widthRef.current - step;
    else if (e.key === "Home") raw = SIDEBAR_MAX_WIDTH;
    else if (e.key === "End") raw = SIDEBAR_MIN_WIDTH;
    else return;
    e.preventDefault();
    const next = clampSidebarWidth(raw, stageWidthOf(e.currentTarget));
    setWidth(next);
    saveSidebarWidth(next);
  };

  return (
    <aside className="sidebar" style={{ width }}>
      <div
        className="sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onDoubleClick={() => {
          setWidth(SIDEBAR_MIN_WIDTH);
          saveSidebarWidth(SIDEBAR_MIN_WIDTH);
        }}
        onKeyDown={onResizeKeyDown}
      />
      <div className="tabs">
        {(
          ["score", "player", "notes", "action", "util", "clutch", "rounds", "weapons"] as const
        ).map((id) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "on" : ""}
            disabled={tabDisabled(id)}
            title={tabDisabled(id) ? "Not available in aggregated view" : undefined}
            onClick={() => setTab(id)}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>
      {activeTab === "score" && (
        <Scoreboard replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {activeTab === "player" &&
        (showSeriesReview && seriesReview ? (
          <SeriesPlayerReview review={seriesReview} onJump={habits.playRound} />
        ) : (
          <Review
            replay={replay}
            tick={tick}
            selected={selected}
            onJump={onJump}
            onSelect={(i) => onSelect(i)}
          />
        ))}
      {activeTab === "notes" && (
        <Notes
          replay={replay}
          tick={tick}
          strokes={strokes}
          onJump={onJump}
          onStrokes={onStrokes}
        />
      )}
      {activeTab === "action" && (
        <>
          {seriesMode && <SeriesBucketPanel />}
          {showSeriesAction ? (
            <SeriesActionList beats={habits.seriesActionBeats} onJump={habits.playRound} />
          ) : (
            <Action replay={replay} tick={tick} onJump={onJump} places={places} />
          )}
        </>
      )}
      {activeTab === "util" && (
        <>
          {seriesMode && <SeriesBucketPanel />}
          {showSeriesUtil ? (
            <SeriesUtilList
              rows={habits.seriesUtilThrows}
              playerName={playerName}
              onJump={habits.playRound}
            />
          ) : (
            <Utility
              replay={replay}
              tick={tick}
              selected={selected}
              onJump={onJump}
              onSelect={(i) => onSelect(i)}
              places={places}
            />
          )}
        </>
      )}
      {activeTab === "clutch" && (
        <Clutch
          replay={replay}
          tick={tick}
          selected={selected}
          onJump={onJump}
          onSelect={(i) => onSelect(i)}
        />
      )}
      {activeTab === "rounds" && (
        <RoundList replay={replay} tick={tick} onJump={onJump} onSelect={onSelect} />
      )}
      {activeTab === "weapons" && (
        <WeaponTable replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {selected == null && activeTab === "score" && (
        <p className="muted tab-hint">
          Click a player for full stats. Click again on the map to deselect.
        </p>
      )}
      {activeTab === "score" && selected != null && (
        <RatingHint replay={replay} tick={tick} selected={selected} />
      )}
    </aside>
  );
});

/** Split out so `weaponBreakdown` only runs while its tab is open. */
function WeaponTable({
  replay,
  tick,
  selected,
  onSelect,
}: {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const weapons = weaponBreakdown(replay, tick, selected);
  return (
    <div>
      <p className="muted tab-hint">
        {selected != null ? replay.players[selected]?.name : "Select a player or view match totals"}
        {selected != null && (
          <>
            {" "}
            <button type="button" className="link" onClick={() => onSelect(null)}>
              (all)
            </button>
          </>
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>Weapon</th>
            <th>K</th>
            <th>HS</th>
            <th>DMG</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w) => (
            <tr key={w.weapon}>
              <td className="wep-cell">
                <WeaponIcon weapon={w.raw} />
                <span>{w.weapon}</span>
              </td>
              <td>{w.kills}</td>
              <td>{w.kills ? `${Math.round((100 * w.headshots) / w.kills)}%` : "—"}</td>
              <td>{w.damage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatingHint({
  replay,
  tick,
  selected,
}: {
  replay: Replay;
  tick: number;
  selected: number;
}) {
  const stats = computeStats(replay, tick);
  return (
    <p className="muted tab-hint">
      {stats.find((s) => s.player === selected)?.rating.toFixed(2)} rating through this tick
    </p>
  );
}
