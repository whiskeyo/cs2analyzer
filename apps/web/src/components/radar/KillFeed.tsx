import { memo } from "react";
import { KILL_FEED_MAX_ROWS, KILL_FEED_SECONDS, tickRate } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import { currentSide, recentKills } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { GearIcon, WeaponIcon } from "@/components/weapons/WeaponIcon";

function sideClass(replay: Replay, index: number, tick: number): string {
  if (index < 0) return "";
  return currentSide(replay, index, tick) === "CT" ? "ct" : "t";
}

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

export const KillFeed = memo(function KillFeed({ replay, tick, onJump }: Props) {
  const tps = tickRate(replay);
  const kills = recentKills(replay, tick, tps * KILL_FEED_SECONDS, KILL_FEED_MAX_ROWS);
  if (kills.length === 0) return null;
  return (
    <ol className="kill-feed">
      {kills.map((k, i) => (
        <li key={`${k.tick}-${i}`}>
          <button type="button" onClick={() => onJump(k.tick)}>
            <span className={`att ${sideClass(replay, k.attacker, k.tick)}`.trim()}>
              {replay.players[k.attacker]?.name ?? "World"}
            </span>
            {k.assisted_flash && <GearIcon name="flashbang_assist" title="Flash assist" />}
            <span className="gun">
              <WeaponIcon weapon={k.weapon} />
              {k.noscope && <GearIcon name="noscope" title="No-scope" />}
              {k.through_smoke && <GearIcon name="through_smoke" title="Through smoke" />}
              {k.wallbang && <GearIcon name="wallbang" title="Wallbang" />}
              {k.attacker_airborne && <GearIcon name="attacker_airborne" title="Airborne" />}
              {k.attacker_blind && <GearIcon name="attacker_blind" title="Blind" />}
              {k.headshot && (
                <img
                  className="headshot-icon"
                  src={publicUrl("weapons/headshot.svg")}
                  alt=""
                  title="Headshot"
                />
              )}
            </span>
            <span className={`vic ${sideClass(replay, k.victim, k.tick)}`.trim()}>
              {replay.players[k.victim]?.name ?? "?"}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
});
