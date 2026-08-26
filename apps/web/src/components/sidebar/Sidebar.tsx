import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "@/lib/shared/constants";
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

type Tab = "score" | "player" | "notes" | "action" | "util" | "clutch" | "rounds" | "weapons";

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

export function Sidebar({
  replay,
  tick,
  strokes,
  selected,
  onSelect,
  onJump,
  onStrokes,
  places,
}: Props) {
  const [tab, setTab] = useState<Tab>("score");
  const [width, setWidth] = useState(loadSidebarWidth);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;
  const stats = computeStats(replay, tick);
  const weapons = weaponBreakdown(replay, tick, selected);

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
            className={tab === id ? "on" : ""}
            onClick={() => setTab(id)}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>
      {tab === "score" && (
        <Scoreboard replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {tab === "player" && (
        <Review
          replay={replay}
          tick={tick}
          selected={selected}
          onJump={onJump}
          onSelect={(i) => onSelect(i)}
        />
      )}
      {tab === "notes" && (
        <Notes
          replay={replay}
          tick={tick}
          strokes={strokes}
          onJump={onJump}
          onStrokes={onStrokes}
        />
      )}
      {tab === "action" && <Action replay={replay} tick={tick} onJump={onJump} places={places} />}
      {tab === "util" && (
        <Utility
          replay={replay}
          tick={tick}
          selected={selected}
          onJump={onJump}
          onSelect={(i) => onSelect(i)}
          places={places}
        />
      )}
      {tab === "clutch" && (
        <Clutch
          replay={replay}
          tick={tick}
          selected={selected}
          onJump={onJump}
          onSelect={(i) => onSelect(i)}
        />
      )}
      {tab === "rounds" && (
        <RoundList replay={replay} tick={tick} onJump={onJump} onSelect={onSelect} />
      )}
      {tab === "weapons" && (
        <div>
          <p className="muted tab-hint">
            {selected != null
              ? replay.players[selected]?.name
              : "Select a player or view match totals"}
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
      )}
      {selected == null && tab === "score" && (
        <p className="muted tab-hint">
          Click a player for full stats. Click again on the map to deselect.
        </p>
      )}
      {tab === "score" && selected != null && (
        <p className="muted tab-hint">
          {stats.find((s) => s.player === selected)?.rating.toFixed(2)} rating through this tick
        </p>
      )}
    </aside>
  );
}
