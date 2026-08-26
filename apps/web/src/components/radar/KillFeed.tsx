import { KILL_FEED_SECONDS, tickRate } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import { recentKills } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { GearIcon, WeaponIcon } from "@/components/weapons/WeaponIcon";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

export function KillFeed({ replay, tick, onJump }: Props) {
  const tps = tickRate(replay);
  const kills = recentKills(replay, tick, tps * KILL_FEED_SECONDS, 6);
  if (kills.length === 0) return null;
  return (
    <ol className="kill-feed">
      {kills.map((k, i) => (
        <li key={`${k.tick}-${i}`}>
          <button type="button" onClick={() => onJump(k.tick)}>
            <span className="att">{replay.players[k.attacker]?.name ?? "World"}</span>
            {k.assisted_flash && <GearIcon name="flashbang_assist" title="Flash assist" />}
            <span className="gun">
              <WeaponIcon weapon={k.weapon} />
              {k.headshot && (
                <img
                  className="headshot-icon"
                  src={publicUrl("weapons/headshot.svg")}
                  alt=""
                  title="Headshot"
                />
              )}
            </span>
            <span className="vic">{replay.players[k.victim]?.name ?? "?"}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
