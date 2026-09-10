import {
  formatBlind,
  formatUtilHit,
  splitUtilBlinds,
  type UtilBlind,
  type UtilHit,
  type UtilThrowRow,
} from "@/lib/match/utility";

interface Props {
  row: UtilThrowRow;
}

function BlindChips({ blinds, tone }: { blinds: UtilBlind[]; tone: "enemy" | "team" }) {
  return (
    <span className="util-throw-chips">
      {blinds.map((blind, i) => (
        <span key={`${tone}-${blind.victim}-${i}`} className={`util-throw-chip ${tone}`}>
          {formatBlind(blind)}
        </span>
      ))}
    </span>
  );
}

function HitChips({ hits }: { hits: UtilHit[] }) {
  return (
    <span className="util-throw-chips">
      {hits.map((hit, i) => (
        <span key={`hit-${hit.victim}-${i}`} className="util-throw-chip">
          {formatUtilHit(hit)}
        </span>
      ))}
    </span>
  );
}

/** Enemy / team flash times and HE hits as labeled chips, not one wrapping sentence. */
export function UtilThrowDetail({ row }: Props) {
  const { enemy, team } = splitUtilBlinds(row.blinds);
  if (enemy.length === 0 && team.length === 0 && row.hits.length === 0) return null;

  return (
    <span className="util-throw-detail">
      {enemy.length > 0 ? (
        <span className="util-throw-line">
          <span className="util-throw-kicker">Enemy</span>
          <BlindChips blinds={enemy} tone="enemy" />
        </span>
      ) : null}
      {team.length > 0 ? (
        <span className="util-throw-line">
          <span className="util-throw-kicker">Team</span>
          <BlindChips blinds={team} tone="team" />
        </span>
      ) : null}
      {row.hits.length > 0 ? (
        <span className="util-throw-line">
          <HitChips hits={row.hits} />
        </span>
      ) : null}
    </span>
  );
}
