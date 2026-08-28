import { ACTION_HIGHLIGHT_SECONDS, tickRate } from "@/lib/shared/constants";
import { useMemo, useState } from "react";
import { type ExecuteKind, filterExecutes, findExecutes } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import { layoutGroupFilters } from "@/lib/radar/layouts";
import { roundStories } from "@/lib/match/roundStory";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Side } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
  places: MapPlaces | null;
}

const KINDS: { id: ExecuteKind; label: string }[] = [
  { id: "execute", label: "Execute" },
  { id: "plant", label: "Plant" },
  { id: "retake", label: "Retake" },
  { id: "fight", label: "Fight" },
];

export function Action({ replay, tick, onJump, places }: Props) {
  const [thisRound, setThisRound] = useState(false);
  const [side, setSide] = useState<Side | "all">("all");
  const [group, setGroup] = useState<string | "all">("all");
  const [kinds, setKinds] = useState<ExecuteKind[]>([]);
  const live = currentRound(replay, tick);
  const stories = useMemo(() => roundStories(replay), [replay]);
  const beats = useMemo(() => findExecutes(replay, places), [replay, places]);
  const groups = layoutGroupFilters(places?.layout);
  const groupFilter: string | "all" =
    group !== "all" && !groups.some((g) => g.id === group) ? "all" : group;
  const roundN = thisRound ? (live && !live.is_knife ? live.number : -1) : null;
  const filtered = useMemo(
    () =>
      filterExecutes(beats, {
        round: roundN,
        side,
        group: groupFilter,
        layout: places?.layout,
        kinds,
      }),
    [beats, roundN, side, groupFilter, places?.layout, kinds],
  );
  const visibleStories = roundN != null ? stories.filter((s) => s.round === roundN) : stories;

  const toggleKind = (k: ExecuteKind) => {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  return (
    <div className="review">
      <p className="tab-hint">
        Round story, then the hits. <kbd>e</kbd> / <kbd>E</kbd> next/prev execute.
      </p>
      <div className="filters" role="toolbar" aria-label="Action filters">
        <button
          type="button"
          className={`filter${thisRound ? "" : " on"}`}
          onClick={() => setThisRound(false)}
        >
          All rounds
        </button>
        <button
          type="button"
          className={`filter${thisRound ? " on" : ""}`}
          onClick={() => setThisRound(true)}
        >
          This round
        </button>
        <span className="filter-gap" />
        <button
          type="button"
          className={`filter${side === "all" ? " on" : ""}`}
          onClick={() => setSide("all")}
        >
          Both
        </button>
        <button
          type="button"
          className={`filter${side === "T" ? " on" : ""}`}
          onClick={() => setSide("T")}
        >
          T
        </button>
        <button
          type="button"
          className={`filter${side === "CT" ? " on" : ""}`}
          onClick={() => setSide("CT")}
        >
          CT
        </button>
        {groups.length > 0 && (
          <>
            <span className="filter-gap" />
            <button
              type="button"
              className={`filter${groupFilter === "all" ? " on" : ""}`}
              onClick={() => setGroup("all")}
            >
              All
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`filter${groupFilter === g.id ? " on" : ""}`}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </>
        )}
        <span className="filter-gap" />
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`filter${kinds.includes(k.id) ? " on" : ""}`}
            onClick={() => toggleKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>
      {visibleStories.length === 0 ? (
        <p className="muted tab-hint">No competitive rounds to show.</p>
      ) : (
        visibleStories.map((story) => {
          const rows = filtered.filter((b) => b.round === story.round);
          const on = live?.number === story.round;
          return (
            <div key={story.round} className="action-round">
              <button
                type="button"
                className={`round-story${on ? " on" : ""}${story.winner === "CT" ? " ct" : story.winner === "T" ? " t" : ""}`}
                onClick={() => onJump(story.jumpTick)}
              >
                <span className="pill review-round">{story.roundLabel}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {story.winner ?? "—"} · {story.ending}
                  </span>
                  <span className="review-detail">{story.summary}</span>
                </span>
              </button>
              {rows.length > 0 && (
                <ul className="review-notes">
                  {rows.map((b) => {
                    const liveBeat =
                      tick >= b.tick &&
                      tick <= b.actionTick + tickRate(replay) * ACTION_HIGHLIGHT_SECONDS;
                    return (
                      <li key={`${b.actionTick}-${b.kind}`}>
                        <button
                          type="button"
                          className={`review-note ${b.kind}${liveBeat ? " on" : ""}`}
                          onClick={() => onJump(b.tick)}
                        >
                          <span className="pill review-round">{b.kind}</span>
                          <span className="review-copy">
                            <span className="review-title">{b.title}</span>
                            <span className="review-detail">{b.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
