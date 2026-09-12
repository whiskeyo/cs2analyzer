import { memo, useMemo, useState } from "react";
import { useMessages } from "@/lib/i18n";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "@/lib/shared/constants";
import { useApp } from "@/lib/state/appState";
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

type Tab = "score" | "player" | "notes" | "action" | "util" | "rounds" | "weapons";

const DEMO_ONLY_TABS: Tab[] = ["score", "notes", "rounds", "weapons"];

export const Sidebar = memo(function Sidebar() {
  const { messages } = useMessages();
  const tabLabel: Record<Tab, string> = {
    score: messages.sidebar.tabScore,
    player: messages.sidebar.tabReview,
    notes: messages.sidebar.tabNotes,
    action: messages.sidebar.tabAction,
    util: messages.sidebar.tabUtility,
    rounds: messages.sidebar.tabRounds,
    weapons: messages.sidebar.tabWeapons,
  };
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

  const [tab, setTab] = useState<Tab>("score");
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
    label: messages.sidebar.resize,
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
              title={tabDisabled(id) ? messages.sidebar.tabDisabledAggregated : undefined}
              onClick={() => setTab(id)}
            >
              {tabLabel[id]}
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
          <p className="muted tab-hint">{messages.sidebar.hintSelectPlayer}</p>
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
  const { messages } = useMessages();
  const [allGame, setAllGame] = useState(true);
  const until = allGame ? matchEndTick(replay) : tick;
  const weapons = weaponBreakdown(replay, until, selected);
  return (
    <div>
      <p className="muted tab-hint">
        {selected != null ? replay.players[selected]?.name : messages.sidebar.weaponsHint}
        {selected != null && (
          <>
            {" "}
            <button type="button" className="link" onClick={() => onSelect(null)}>
              {messages.sidebar.weaponsAll}
            </button>
          </>
        )}
      </p>
      <div className="filters" role="toolbar" aria-label={messages.sidebar.weaponsRange}>
        <button
          type="button"
          className={`filter${allGame ? "" : " on"}`}
          onClick={() => setAllGame(false)}
        >
          {messages.sidebar.untilNow}
        </button>
        <button
          type="button"
          className={`filter${allGame ? " on" : ""}`}
          onClick={() => setAllGame(true)}
        >
          {messages.sidebar.allGame}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>{messages.sidebar.colWeapon}</th>
            <th>{messages.sidebar.colKills}</th>
            <th>{messages.sidebar.colHeadshots}</th>
            <th>{messages.sidebar.colDamage}</th>
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
  const { messages, t } = useMessages();
  const stats = computeStats(replay, tick);
  return (
    <p className="muted tab-hint">
      {t(messages.sidebar.ratingThroughTick, {
        rating: stats.find((s) => s.player === selected)?.rating.toFixed(2) ?? "",
      })}
    </p>
  );
}
