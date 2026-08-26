import { useState } from "react";
import { NADE_LABEL, NADE_WEAPON } from "@/lib/match/roundEvents";
import {
  throwDetail,
  usedUtilCallouts,
  usedUtilKinds,
  utilKindSummary,
  utilMatchesCallout,
  utilityThrough,
} from "@/lib/match/utility";
import { placesReady, type MapPlaces } from "@/lib/match/sites";
import type { GrenadeKind, Replay } from "@/lib/replay/replayTypes";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
  places: MapPlaces | null;
}

function toggleIn<T>(prev: T[], id: T): T[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

function kept<T>(selected: T[], available: T[]): T[] {
  return selected.filter((id) => available.includes(id));
}

export function Utility({ replay, tick, selected, onJump, onSelect, places }: Props) {
  const u = utilityThrough(replay, tick, selected, places);
  const who = selected != null ? (replay.players[selected]?.name ?? "Player") : "Match";
  const hasPlaces = placesReady(places);
  const kinds = usedUtilKinds(u.throws);
  const callouts = usedUtilCallouts(u.throws, places?.layout);
  const [kindSel, setKindSel] = useState<GrenadeKind[]>([]);
  const [calloutSel, setCalloutSel] = useState<string[]>([]);
  const kindsOn = kept(kindSel, kinds);
  const calloutsOn = kept(calloutSel, callouts);
  const rows = u.throws.filter((row) => {
    if (kindsOn.length > 0 && !kindsOn.includes(row.kind)) return false;
    if (calloutsOn.length > 0 && !calloutsOn.some((name) => utilMatchesCallout(row, name))) {
      return false;
    }
    return true;
  });
  const kindCounts = utilKindSummary(u.byKind);
  const summary = [
    `${u.throws.length} thrown`,
    kindCounts,
    hasPlaces ? `${u.inSite} in site · A ${u.nadesA} · B ${u.nadesB}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{who}</strong> — nades in throw order.
      </p>
      <h3 className="util-head">
        Nades <span className="muted">{summary}</span>
      </h3>
      {kinds.length > 0 && (
        <div className="filters" role="toolbar" aria-label="Nade type filters">
          <button
            type="button"
            className="filter clear"
            title="Show all nade types"
            aria-label="Show all nade types"
            disabled={kindsOn.length === 0}
            onClick={() => setKindSel([])}
          >
            ×
          </button>
          {kinds.map((id) => (
            <button
              key={id}
              type="button"
              className={`filter${kindsOn.includes(id) ? " on" : ""}`}
              onClick={() => setKindSel((prev) => toggleIn(kept(prev, kinds), id))}
            >
              {NADE_LABEL[id]}
            </button>
          ))}
        </div>
      )}
      {callouts.length > 0 && (
        <div className="filters" role="toolbar" aria-label="Nade callout filters">
          <button
            type="button"
            className="filter clear"
            title="Show all positions"
            aria-label="Show all positions"
            disabled={calloutsOn.length === 0}
            onClick={() => setCalloutSel([])}
          >
            ×
          </button>
          {callouts.map((name) => (
            <button
              key={name}
              type="button"
              className={`filter${calloutsOn.includes(name) ? " on" : ""}`}
              onClick={() => setCalloutSel((prev) => toggleIn(kept(prev, callouts), name))}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="muted tab-hint">
          {u.throws.length === 0
            ? "No nades thrown through this tick."
            : "No nades match these filters."}
        </p>
      ) : (
        <ul className="review-notes">
          {rows.map((row, i) => {
            const detail = throwDetail(row);
            const lit =
              row.inSite ||
              row.blinds.some((blind) => blind.enemy) ||
              row.hits.some((hit) => hit.enemy);
            return (
              <li key={`${row.tick}-${row.thrower}-${row.kind}-${i}`}>
                <button
                  type="button"
                  className={`review-note ${lit ? "good" : ""}`}
                  onClick={() => {
                    if (row.thrower >= 0) onSelect(row.thrower);
                    onJump(row.tick);
                  }}
                >
                  <span className="pill review-round">{row.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title util-nade-title">
                      <WeaponIcon weapon={NADE_WEAPON[row.kind]} />
                      {row.throwerName} · {row.location ?? "—"}
                    </span>
                    {detail ? <span className="review-detail">{detail}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
