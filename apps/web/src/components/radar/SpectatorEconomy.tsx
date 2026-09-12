import { memo } from "react";
import { useMessages } from "@/lib/i18n";
import {
  formatMoney,
  gearIconHeldClass,
  gearItems,
  heldIconClass,
  heldWeaponId,
  mainWeaponId,
  sidearmId,
  weaponHasMagazine,
  WID_KNIFE,
} from "@/lib/weapons/loadout";
import { playerLabel } from "@/lib/replay/playerLabel";
import { samplePlayers, type SampledPlayer } from "@/lib/replay/sample";
import { freezeBuysForPlayer } from "@/lib/match/buys";
import { computeStats, liveScoreboardPlayers, liveTeams } from "@/lib/stats/stats";
import { formatLastHitLocalized, lastHitTaken } from "@/lib/stats/lastHit";
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
  lastHit,
  buys,
  selected,
  onSelect,
  cashTitle,
  freezeBuyTitle,
  knifeTitle,
}: {
  p: SampledPlayer;
  name: string;
  kd: string;
  lastHit: string | null;
  buys: ReturnType<typeof freezeBuysForPlayer>;
  selected: boolean;
  onSelect: () => void;
  cashTitle: string;
  freezeBuyTitle: string;
  knifeTitle: string;
}) {
  const hp = p.alive ? p.health : 0;
  const gun = mainWeaponId(p);
  const pistol = sidearmId(p);
  const active = heldWeaponId(p);
  const items = gearItems(p);
  if (active === WID_KNIFE && !items.some((ic) => ic.name === "knife")) {
    items.unshift({ name: "knife", title: knifeTitle });
  }
  const iconClass = (base: string, id: number) => {
    const held = heldIconClass(id, active);
    return held ? `${base} ${held}` : base;
  };
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
          <span className="spec-money" title={cashTitle}>
            {formatMoney(p.money)}
            <span className="spec-eq">{formatMoney(p.equip)}</span>
          </span>
        </div>
        <div className="spec-mid">
          <span className="spec-hp-n">{hp}</span>
          {gun > 0 ? (
            <WeaponIcon weapon={gun} className={iconClass("primary", gun)} />
          ) : (
            <span className="spec-unarmed" />
          )}
          {p.alive && weaponHasMagazine(active) && (
            <span className="spec-ammo">
              {p.clip}/{p.reserve}
            </span>
          )}
        </div>
        <div className="spec-gear">
          {pistol > 0 && <WeaponIcon weapon={pistol} className={iconClass("sidearm", pistol)} />}
          {items.map((ic, i) => (
            <GearIcon
              key={`${ic.name}-${i}`}
              name={ic.name}
              title={ic.title}
              className={gearIconHeldClass(ic.name, active)}
            />
          ))}
        </div>
        {buys.length > 0 && (
          <div className="spec-buys" title={freezeBuyTitle}>
            {buys.map((e, i) => (
              <WeaponIcon key={`${e.tick}-${e.weapon}-${i}`} weapon={e.weapon} />
            ))}
          </div>
        )}
        {lastHit && <div className="spec-last-hit">{lastHit}</div>}
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
  const { messages } = useMessages();
  const samples = samplePlayers(replay, tick);
  const stats = computeStats(replay, tick);
  const teams = liveTeams(replay, tick);
  const live = new Set(liveScoreboardPlayers(replay, tick));
  const rows = samples
    .filter((p) => live.has(p.index))
    .map((p) => {
      const s = stats[p.index];
      return {
        p,
        name: playerLabel(replay.players[p.index]),
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
          <strong title={messages.spectator.cashInventory}>
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
            lastHit={
              selected === p.index
                ? formatLastHitLocalized(
                    lastHitTaken(replay, tick, p.index),
                    messages.spectator.lastHit,
                    messages.spectator.lastHitArmor,
                  )
                : null
            }
            buys={freezeBuysForPlayer(replay, p.index, tick)}
            selected={selected === p.index}
            onSelect={() => onSelect(selected === p.index ? null : p.index)}
            cashTitle={messages.spectator.cashInventory}
            freezeBuyTitle={messages.spectator.boughtThisFreeze}
            knifeTitle={messages.spectator.knife}
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
