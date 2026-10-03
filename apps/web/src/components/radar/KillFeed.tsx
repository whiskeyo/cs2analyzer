import { memo } from "react";
import { environmentDeath, visibleKillFeed } from "@/lib/radar/killFeed";
import { publicUrl } from "@/lib/shared/publicUrl";
import { currentSide } from "@/lib/stats/stats";
import { attackerLabel, playerLabel } from "@/lib/replay/playerLabel";
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
  const kills = visibleKillFeed(replay, tick);
  if (kills.length === 0) return null;
  return (
    <ol className="kill-feed">
      {kills.map((k, i) => {
        const environment = environmentDeath(k);
        return (
          <li key={`${k.tick}-${i}`}>
            <button type="button" onClick={() => onJump(k.tick)}>
              {environment == null && (
                <span className={`att ${sideClass(replay, k.attacker, k.tick)}`.trim()}>
                  {attackerLabel(replay, k.attacker)}
                </span>
              )}
              {environment == null && k.assister >= 0 && (
                <span className={`assist ${sideClass(replay, k.assister, k.tick)}`.trim()}>
                  + {playerLabel(replay.players[k.assister])}
                </span>
              )}
              {environment == null && k.assisted_flash && (
                <GearIcon name="flashbang_assist" title="Flash assist" />
              )}
              <span className="gun">
                {environment === "bomb" ? (
                  <WeaponIcon weapon="c4" />
                ) : environment === "skull" ? (
                  <GearIcon name="skull" title="Kill" />
                ) : (
                  <WeaponIcon weapon={k.weapon} />
                )}
                {environment == null && k.noscope && <GearIcon name="noscope" title="No-scope" />}
                {environment == null && k.through_smoke && (
                  <GearIcon name="through_smoke" title="Through smoke" />
                )}
                {environment == null && k.wallbang && <GearIcon name="wallbang" title="Wallbang" />}
                {environment == null && k.attacker_airborne && (
                  <GearIcon name="attacker_airborne" title="Airborne" />
                )}
                {environment == null && k.attacker_blind && (
                  <GearIcon name="attacker_blind" title="Blind" />
                )}
                {environment == null && k.headshot && (
                  <img
                    className="headshot-icon"
                    src={publicUrl("weapons/headshot.svg")}
                    alt=""
                    title="Headshot"
                  />
                )}
              </span>
              <span className={`vic ${sideClass(replay, k.victim, k.tick)}`.trim()}>
                {playerLabel(replay.players[k.victim])}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
});
