import {
  formatBlind,
  formatUtilHit,
  splitUtilBlinds,
  splitUtilHits,
  type UtilThrowRow,
} from "@/lib/match/utility";

interface Props {
  row: UtilThrowRow;
}

function ChipLine({
  kicker,
  tone,
  chips,
}: {
  kicker: "Enemy" | "Team";
  tone: "enemy" | "team";
  chips: { key: string; label: string }[];
}) {
  if (chips.length === 0) return null;
  return (
    <span className="util-throw-line">
      <span className="util-throw-kicker">{kicker}</span>
      <span className="util-throw-chips">
        {chips.map((chip) => (
          <span key={chip.key} className={`util-throw-chip ${tone}`}>
            {chip.label}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Enemy / team flash times and HE / molly hits as labeled chips, not one wrapping sentence. */
export function UtilThrowDetail({ row }: Props) {
  const blinds = splitUtilBlinds(row.blinds);
  const hits = splitUtilHits(row.hits);
  if (
    blinds.enemy.length === 0 &&
    blinds.team.length === 0 &&
    hits.enemy.length === 0 &&
    hits.team.length === 0
  ) {
    return null;
  }

  return (
    <span className="util-throw-detail">
      <ChipLine
        kicker="Enemy"
        tone="enemy"
        chips={blinds.enemy.map((blind, i) => ({
          key: `blind-enemy-${blind.victim}-${i}`,
          label: formatBlind(blind),
        }))}
      />
      <ChipLine
        kicker="Team"
        tone="team"
        chips={blinds.team.map((blind, i) => ({
          key: `blind-team-${blind.victim}-${i}`,
          label: formatBlind(blind),
        }))}
      />
      <ChipLine
        kicker="Enemy"
        tone="enemy"
        chips={hits.enemy.map((hit, i) => ({
          key: `hit-enemy-${hit.victim}-${i}`,
          label: formatUtilHit(hit),
        }))}
      />
      <ChipLine
        kicker="Team"
        tone="team"
        chips={hits.team.map((hit, i) => ({
          key: `hit-team-${hit.victim}-${i}`,
          label: formatUtilHit(hit),
        }))}
      />
    </span>
  );
}
