import { memo } from "react";
import { formatMoney, gearItems, mainWeaponId, sidearmId } from "@/lib/weapons/loadout";
import { samplePlayers, type SampledPlayer } from "@/lib/replay/sample";
import { computeStats, liveTeams } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { GearIcon, WeaponIcon } from "@/components/weapons/WeaponIcon";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}

function PlayerCard({
  p,
  name,
  kd,
  selected,
  onSelect,
}: {
  p: SampledPlayer;
  name: string;
  kd: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const hp = p.alive ? p.health : 0;
  const gun = mainWeaponId(p);
  const pistol = sidearmId(p);
  const items = gearItems(p);
  return (
    <button
      type="button"
      className={`spec-card${selected ? " on" : ""}${p.alive ? "" : " dead"}`}
      onClick={onSelect}
    >
      <div className="spec-hp" aria-hidden>
        <div
          className={`spec-hp-fill${hp <= 20 && hp > 0 ? " low" : ""}`}
          style={{ height: `${hp}%` }}
        />
      </div>
      <div className="spec-body">
        <div className="spec-top">
          <span className="spec-name">{name}</span>
          <span className="spec-kd">{kd}</span>
          <span className="spec-money" title="Cash · inventory">
            {formatMoney(p.money)}
            <span className="spec-eq">{formatMoney(p.equip)}</span>
          </span>
        </div>
        <div className="spec-mid">
          <span className="spec-hp-n">{hp}</span>
          {gun > 0 ? (
            <WeaponIcon weapon={gun} className="primary" />
          ) : (
            <span className="spec-unarmed" />
          )}
        </div>
        <div className="spec-gear">
          {pistol > 0 && <WeaponIcon weapon={pistol} className="sidearm" />}
          {items.map((ic, i) => (
            <GearIcon key={`${ic.name}-${i}`} name={ic.name} title={ic.title} />
          ))}
        </div>
      </div>
    </button>
  );
}

export const SpectatorEconomy = memo(function SpectatorEconomy({
  replay,
  tick,
  selected,
  onSelect,
}: Props) {
  const samples = samplePlayers(replay, tick);
  const stats = computeStats(replay, tick);
  const teams = liveTeams(replay, tick);
  const rows = samples
    .filter((p) => p.present)
    .map((p) => {
      const s = stats[p.index];
      return {
        p,
        name: replay.players[p.index]?.name ?? "?",
        kd: s ? `${s.kills}-${s.deaths}` : "0-0",
      };
    });
  const t = rows.filter((r) => !r.p.ct);
  const ct = rows.filter((r) => r.p.ct);

  const column = (side: "t" | "ct", title: string, list: typeof t) => {
    const total = list.reduce((sum, r) => sum + r.p.money, 0);
    const eq = list.reduce((sum, r) => sum + r.p.equip, 0);
    const alive = list.filter((r) => r.p.alive).length;
    return (
      <div className={`spec-eco ${side}`}>
        <div className="spec-team">
          <span>
            {title} · {alive}
          </span>
          <strong title="Cash · inventory">
            {formatMoney(total)}
            <span className="spec-eq">{formatMoney(eq)}</span>
          </strong>
        </div>
        {list.map(({ p, name, kd }) => (
          <PlayerCard
            key={p.index}
            p={p}
            name={name}
            kd={kd}
            selected={selected === p.index}
            onSelect={() => onSelect(selected === p.index ? null : p.index)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {column("t", teams.tName, t)}
      {column("ct", teams.ctName, ct)}
    </>
  );
});
