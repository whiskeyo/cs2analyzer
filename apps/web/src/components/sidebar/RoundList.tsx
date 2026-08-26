import { tickRate } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import { useMemo, useState } from "react";
import {
  BOMB_LABEL,
  BOMB_WEAPON,
  clampLeadInSec,
  eventPlayer,
  eventsForRound,
  jumpBefore,
  loadLeadInSec,
  MAX_LEAD_IN_SEC,
  MIN_LEAD_IN_SEC,
  NADE_LABEL,
  NADE_WEAPON,
  roundClock,
  saveLeadInSec,
  type RoundEvent,
} from "@/lib/match/roundEvents";
import { currentRound } from "@/lib/replay/sample";
import { currentSide } from "@/lib/stats/stats";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { winReasonLabel } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
  onSelect: (index: number | null) => void;
}

export function RoundList({ replay, tick, onJump, onSelect }: Props) {
  const live = currentRound(replay, tick);
  const liveStart = live?.start_tick;
  const [override, setOverride] = useState<Map<number, boolean>>(() => new Map());
  const [leadIn, setLeadIn] = useState(loadLeadInSec);

  const isOpen = (startTick: number) => override.get(startTick) ?? startTick === liveStart;

  const toggle = (startTick: number) => {
    setOverride((prev) => {
      const next = new Map(prev);
      const currently = prev.get(startTick) ?? startTick === liveStart;
      next.set(startTick, !currently);
      return next;
    });
  };

  const expand = (startTick: number) => {
    setOverride((prev) => new Map(prev).set(startTick, true));
  };

  const eventsByRound = useMemo(() => {
    const map = new Map<number, RoundEvent[]>();
    for (const r of replay.rounds) {
      map.set(r.start_tick, eventsForRound(replay, r));
    }
    return map;
  }, [replay]);

  const setLead = (raw: number) => {
    const next = clampLeadInSec(raw);
    setLeadIn(next);
    saveLeadInSec(next);
  };

  const jumpEvent = (round: Round, event: RoundEvent) => {
    const who = eventPlayer(event);
    if (who >= 0) onSelect(who);
    onJump(jumpBefore(replay, round, event.tick, leadIn));
  };

  const rate = tickRate(replay);

  return (
    <div className="round-panel">
      <label className="lead-in">
        Lead-in
        <input
          type="number"
          min={MIN_LEAD_IN_SEC}
          max={MAX_LEAD_IN_SEC}
          step={0.5}
          value={leadIn}
          onChange={(e) => setLead(Number(e.target.value))}
        />
        s
      </label>
      <ul className="round-list">
        {replay.rounds.map((r) => {
          const events = eventsByRound.get(r.start_tick) ?? [];
          const expanded = isOpen(r.start_tick);
          const on = live?.start_tick === r.start_tick;
          const kills = events.filter((e) => e.kind === "kill").length;
          const nades = events.filter((e) => e.kind === "nade").length;
          const bombs = events.filter((e) => e.kind === "bomb").length;
          return (
            <li key={r.start_tick} className={`round-block${on ? " on" : ""}`}>
              <div className="round-row">
                <button
                  type="button"
                  className="round-toggle"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Collapse round" : "Expand round"}
                  onClick={() => toggle(r.start_tick)}
                >
                  {expanded ? "▾" : "▸"}
                </button>
                <button
                  type="button"
                  className={`round-item${on ? " on" : ""}`}
                  onClick={() => {
                    expand(r.start_tick);
                    onJump(r.freeze_end_tick || r.start_tick);
                  }}
                >
                  <span
                    className={`pill ${r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : ""}`}
                  >
                    {r.is_knife ? "Knife" : `R${r.number}`}
                  </span>
                  <span className="round-meta">
                    {r.winner ?? "—"} · {winReasonLabel(r.win_reason)}
                    <span className="round-counts">
                      {kills}k · {nades}n{bombs > 0 ? ` · ${bombs}b` : ""}
                    </span>
                  </span>
                  <span className="round-score">
                    {r.score_ct}-{r.score_t}
                  </span>
                </button>
              </div>
              {expanded && (
                <ul className="round-events">
                  {events.length === 0 ? (
                    <li className="round-empty">No kills, nades, or bomb events</li>
                  ) : (
                    events.map((e, i) => {
                      const next = events[i + 1];
                      const from = jumpBefore(replay, r, e.tick, leadIn);
                      const until = next ? next.tick : e.tick + rate;
                      const active = tick >= from && tick < until;
                      return (
                        <li key={e.key}>
                          <button
                            type="button"
                            className={`round-event ${e.kind}${active ? " on" : ""}`}
                            onClick={() => jumpEvent(r, e)}
                          >
                            <span className="round-clock">{roundClock(r, e.tick, rate)}</span>
                            {e.kind === "kill" ? (
                              <KillLine replay={replay} event={e} tick={e.tick} />
                            ) : e.kind === "nade" ? (
                              <NadeLine replay={replay} event={e} tick={e.tick} />
                            ) : (
                              <BombLine replay={replay} event={e} tick={e.tick} />
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function playerName(replay: Replay, index: number): string {
  if (index < 0) return "World";
  return replay.players[index]?.name ?? "World";
}

function sideClass(replay: Replay, index: number, tick: number): string {
  if (index < 0) return "";
  return currentSide(replay, index, tick) === "CT" ? "ct" : "t";
}

function KillLine({
  replay,
  event,
  tick,
}: {
  replay: Replay;
  event: Extract<RoundEvent, { kind: "kill" }>;
  tick: number;
}) {
  return (
    <span className="round-event-body">
      <span className={`name ${sideClass(replay, event.attacker, tick)}`}>
        {playerName(replay, event.attacker)}
      </span>
      <span className="gun">
        <WeaponIcon weapon={event.weapon} />
        {event.headshot && (
          <img
            className="headshot-icon"
            src={publicUrl("weapons/headshot.svg")}
            alt=""
            title="Headshot"
          />
        )}
      </span>
      <span className={`name ${sideClass(replay, event.victim, tick)}`}>
        {playerName(replay, event.victim)}
      </span>
    </span>
  );
}

function NadeLine({
  replay,
  event,
  tick,
}: {
  replay: Replay;
  event: Extract<RoundEvent, { kind: "nade" }>;
  tick: number;
}) {
  return (
    <span className="round-event-body">
      <span className={`name ${sideClass(replay, event.thrower, tick)}`}>
        {playerName(replay, event.thrower)}
      </span>
      <span className="gun">
        <WeaponIcon weapon={NADE_WEAPON[event.nade]} title={NADE_LABEL[event.nade]} />
      </span>
      <span className={`nade-kind ${event.nade}`}>{NADE_LABEL[event.nade]}</span>
    </span>
  );
}

function BombLine({
  replay,
  event,
  tick,
}: {
  replay: Replay;
  event: Extract<RoundEvent, { kind: "bomb" }>;
  tick: number;
}) {
  const label =
    event.bomb === "begin_defuse" && event.haskit ? "Defusing (kit)" : BOMB_LABEL[event.bomb];
  return (
    <span className="round-event-body">
      <span className={`name ${sideClass(replay, event.player, tick)}`}>
        {playerName(replay, event.player)}
      </span>
      <span className="gun">
        <WeaponIcon weapon={BOMB_WEAPON[event.bomb]} title={label} />
      </span>
      <span className={`bomb-kind ${event.bomb}`}>{label}</span>
    </span>
  );
}
