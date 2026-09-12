import { useState } from "react";
import { nadeLabel, useMessages } from "@/lib/i18n";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import {
  usedUtilKinds,
  usedUtilPlaces,
  utilKindSelected,
  utilKindSummary,
  utilMatchesPlace,
  utilRowTone,
  utilityThrough,
} from "@/lib/match/utility";
import { placesReady, type MapPlaces } from "@/lib/match/sites";
import { playerLabel } from "@/lib/replay/playerLabel";
import type { GrenadeKind, Replay } from "@/lib/replay/replayTypes";
import { matchEndTick } from "@/lib/stats/stats";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { UtilThrowDetail } from "./UtilThrowDetail";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
  onClearFollow?: () => void;
  places: MapPlaces | null;
}

function toggleIn<T>(prev: T[], id: T): T[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

function kept<T>(selected: T[], available: T[]): T[] {
  return selected.filter((id) => available.includes(id));
}

export function Utility({
  replay,
  tick,
  selected,
  onJump,
  onSelect,
  onClearFollow,
  places,
}: Props) {
  const { messages, t, tNodes } = useMessages();
  const u = utilityThrough(replay, matchEndTick(replay), selected, places);
  const who =
    selected != null
      ? playerLabel(replay.players[selected], messages.drop.player)
      : messages.sidebar.utilMatch;
  const hasPlaces = placesReady(places);
  const kinds = usedUtilKinds(u.throws);
  const placeChips = usedUtilPlaces(u.throws, places?.layout);
  const [kindSel, setKindSel] = useState<GrenadeKind[]>([]);
  const [placeSel, setPlaceSel] = useState<string[]>([]);
  const kindsOn = kept(kindSel, kinds);
  const placeKeys = placeChips.map((chip) => chip.key);
  const placesOn = kept(placeSel, placeKeys);
  const rows = u.throws.filter((row) => {
    if (!utilKindSelected(kindsOn, row.kind)) return false;
    if (placesOn.length > 0) {
      const active = placeChips.filter((chip) => placesOn.includes(chip.key));
      if (!active.some((chip) => utilMatchesPlace(row, chip))) return false;
    }
    return true;
  });
  const kindCounts = utilKindSummary(u.byKind);
  const summary = [
    t(messages.sidebar.thrownCount, { count: u.throws.length }),
    kindCounts,
    hasPlaces ? t(messages.sidebar.siteSummary, { count: u.inSite, a: u.nadesA, b: u.nadesB }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="review">
      <p className="tab-hint">
        {tNodes(messages.sidebar.utilHeader, { who: <strong>{who}</strong> })}
      </p>
      <h3 className="util-head">
        {messages.sidebar.nadesHeading} <span className="muted">{summary}</span>
      </h3>
      {kinds.length > 0 && (
        <div className="filters" role="toolbar" aria-label={messages.sidebar.nadeTypeFilters}>
          <button
            type="button"
            className="filter clear"
            title={messages.sidebar.showAllTypes}
            aria-label={messages.sidebar.showAllTypes}
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
              {nadeLabel(messages, id)}
            </button>
          ))}
        </div>
      )}
      {placeChips.length > 0 && (
        <div className="filters" role="toolbar" aria-label={messages.sidebar.calloutFilters}>
          <button
            type="button"
            className="filter clear"
            title={messages.sidebar.showAllPositions}
            aria-label={messages.sidebar.showAllPositions}
            disabled={placesOn.length === 0}
            onClick={() => setPlaceSel([])}
          >
            ×
          </button>
          {placeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`filter${placesOn.includes(chip.key) ? " on" : ""}`}
              title={chip.names.length > 1 ? chip.names.join(", ") : undefined}
              onClick={() => setPlaceSel((prev) => toggleIn(kept(prev, placeKeys), chip.key))}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="muted tab-hint">
          {u.throws.length === 0
            ? messages.sidebar.utilEmptyMatch
            : messages.sidebar.utilEmptyFilters}
        </p>
      ) : (
        <ul className="review-notes">
          {rows.map((row, i) => {
            const tone = utilRowTone(row);
            return (
              <li key={`${row.tick}-${row.thrower}-${row.kind}-${i}`}>
                <button
                  type="button"
                  className={`review-note${tone ? ` ${tone}` : ""}${row.tick > tick ? " pending" : ""}`}
                  onClick={() => {
                    onClearFollow?.();
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
                    <UtilThrowDetail row={row} />
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
