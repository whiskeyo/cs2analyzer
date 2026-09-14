import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "@/lib/shared/constants";
import { useApp } from "@/lib/state/appState";
import { type DefaultSidebarTab } from "@/lib/settings/userSettings";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { isAggregatedView, isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { Action } from "./Action";
import { Review } from "./Review";
import { Notes } from "./Notes";
import { RoundList } from "./RoundList";
import { Scoreboard } from "./Scoreboard";
import { usePanelResize } from "@/lib/shared/usePanelResize";
import { computeStats, matchEndTick, weaponBreakdown } from "@/lib/stats/stats";
import { weaponHeadshotLabel } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";
import { Utility } from "./Utility";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { SeriesBucketPanel } from "./SeriesBucketPanel";
import { SeriesUtilList } from "./SeriesUtilList";
import { SeriesActionList } from "./SeriesActionList";
import { SeriesPlayerReview } from "./SeriesPlayerReview";
import { seriesPlayerReview } from "@/lib/parse/seriesPlayerReview";

type Tab = DefaultSidebarTab;

const DEMO_ONLY_TABS: Tab[] = ["score", "notes", "rounds", "weapons"];

const TAB_LABEL: Record<Tab, string> = {
  score: "Score",
  player: "Review",
  notes: "Notes",
  action: "Action",
  util: "Utility",
  rounds: "Rounds",
  weapons: "Weapons",
};

export const Sidebar = memo(function Sidebar() {
  const { session, playback, review, view, places, habits } = useApp();
  const { settings, update } = useUserSettings();
  const replay = session.replay;
  const tick = playback.tick;
  const notes = review.notes;
  const selected = view.selected;
  const onSelect = view.select;
  const onJump = playback.jump;
  const onNotes = review.commitNotes;
  const activeRound = playback.activeRound;
  const multiDemo = isMultiDemoSeries(session.series);
  const seriesMode = isAggregatedView(session.series, habits);
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

  const [tab, setTab] = useState<Tab>(settings.defaultSidebarTab);
  const choseTab = useRef(false);
  useEffect(() => {
    if (!choseTab.current) {
      setTab(settings.defaultSidebarTab);
    }
  }, [settings.defaultSidebarTab]);
  const activeTab: Tab = seriesMode && DEMO_ONLY_TABS.includes(tab) ? "action" : tab;
  const { width, handleProps } = usePanelResize({
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    defaultWidth: settings.sidebarWidth,
    syncWidth: settings.sidebarWidth,
    onPersist: (next) => {
      void update({ sidebarWidth: next });
    },
    stageSelector: ".stage",
    label: "Resize side panel",
  });

  if (!replay) return null;

  return (
    <aside className="sidebar" style={{ width }}>
      <div {...handleProps} />
      <div className="tabs">
        {(["score", "player", "notes", "action", "util", "rounds", "weapons"] as const).map(
          (id) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? "on" : ""}
              disabled={tabDisabled(id)}
              title={tabDisabled(id) ? "Not available in aggregated view" : undefined}
              onClick={() => {
                choseTab.current = true;
                setTab(id);
              }}
            >
              {TAB_LABEL[id]}
            </button>
          ),
        )}
      </div>
      <div className="sidebar-body">
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
          <Notes replay={replay} tick={tick} notes={notes} onJump={onJump} onNotes={onNotes} />
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
                onClearFollow={() => view.setFollow(false)}
              />
            ) : (
              <Utility
                replay={replay}
                tick={tick}
                selected={selected}
                onJump={onJump}
                onSelect={(i) => onSelect(i)}
                onClearFollow={() => view.setFollow(false)}
                places={places}
              />
            )}
          </>
        )}
        {activeTab === "rounds" && (
          <RoundList
            replay={replay}
            tick={tick}
            onJump={onJump}
            onSelect={onSelect}
            activeRound={activeRound}
            leadInSec={settings.eventLeadInSec}
            onLeadInSecChange={(next) => {
              void update({ eventLeadInSec: next });
            }}
          />
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
      </div>
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
  const [allGame, setAllGame] = useState(true);
  const until = allGame ? matchEndTick(replay) : tick;
  const weapons = weaponBreakdown(replay, until, selected);
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
      <div className="filters" role="toolbar" aria-label="Weapons range">
        <button
          type="button"
          className={`filter${allGame ? "" : " on"}`}
          onClick={() => setAllGame(false)}
        >
          Until now
        </button>
        <button
          type="button"
          className={`filter${allGame ? " on" : ""}`}
          onClick={() => setAllGame(true)}
        >
          All game
        </button>
      </div>
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
              <td>{weaponHeadshotLabel(w.raw, w.kills, w.headshots)}</td>
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
