import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BOMB_SECONDS, DEFAULT_TICK_RATE, PLANT_SECONDS } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_CT, FLAG_DEFUSING, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeFreezeTicks,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { Hud } from "./Hud";

const tps = DEFAULT_TICK_RATE;

function ctSamples(frames: { tick: number; defusing: boolean }[]) {
  const playerCount = 2;
  const buf = makeTicks(playerCount, frames.length);
  frames.forEach((frame, index) => {
    buf.ticks[index] = frame.tick;
    for (let player = 0; player < playerCount; player++) {
      let flags = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      if (frame.defusing && player === 0) flags |= FLAG_DEFUSING;
      buf.flags[index * playerCount + player] = flags;
    }
  });
  return buf;
}

describe("Hud", () => {
  it("counts down the freeze and drops the label once play is live", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 2 * tps, end_tick: 640 })],
    });
    const { rerender } = render(<Hud replay={replay} tick={0} />);
    expect(screen.getByText("Freeze 2.0s")).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={2 * tps} />);
    expect(screen.queryByText(/Freeze/)).not.toBeInTheDocument();
  });

  it("labels the knife round Knife instead of a round number", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
        makeRound({ number: 1, start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
      ],
    });
    const { rerender } = render(<Hud replay={replay} tick={50} />);
    expect(screen.getByText(/Knife/)).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={300} />);
    expect(screen.getByText(/R1/)).toBeInTheDocument();
    expect(screen.queryByText(/Knife/)).not.toBeInTheDocument();
  });

  it("labels overtime with the MR3 period", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 26, start_tick: 0, freeze_end_tick: 64, end_tick: 2000 })],
    });
    render(<Hud replay={replay} tick={100} />);
    expect(screen.getByText(/R26 · OT1/)).toBeInTheDocument();
  });

  it("shows the plant clock after begin_plant and hides it on plant", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [
        makeBombEvent({ tick: 500, kind: "begin_plant", player: 1 }),
        makeBombEvent({ tick: 500 + 4 * tps, kind: "planted", player: 1 }),
      ],
    });
    const { rerender } = render(<Hud replay={replay} tick={500} />);
    expect(screen.getByText(`Plant ${PLANT_SECONDS.toFixed(1)}s`)).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={500 + 4 * tps} />);
    expect(screen.queryByText(/^Plant /)).not.toBeInTheDocument();
    expect(screen.getByText(`C4 ${BOMB_SECONDS.toFixed(1)}s`)).toBeInTheDocument();
  });

  it("shows the C4 clock after a plant and hides it on defuse", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [
        makeBombEvent({ tick: 1000, kind: "planted" }),
        makeBombEvent({ tick: 1000 + 10 * tps, kind: "defused", player: 0 }),
      ],
    });
    const { rerender } = render(<Hud replay={replay} tick={1000 + 5 * tps} />);
    expect(screen.getByText(`C4 ${(BOMB_SECONDS - 5).toFixed(1)}s`)).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={1000 + 11 * tps} />);
    expect(screen.queryByText(/^C4 /)).not.toBeInTheDocument();
  });

  it("hides the C4 clock once every CT is dead", () => {
    // One CT slot, present but not alive: the T side has already won the round.
    const ticks = makeFreezeTicks(2, 1);
    ticks.flags[0] &= ~FLAG_ALIVE;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks,
      bombEvents: [makeBombEvent({ tick: 1000, kind: "planted" })],
    });
    render(<Hud replay={replay} tick={1000 + 5 * tps} />);
    expect(screen.queryByText(/^C4 /)).not.toBeInTheDocument();
  });

  it("swaps the team names on the scoreline after the MR12 halftime", () => {
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      rounds: [
        makeRound({ number: 12, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 200 }),
        makeRound({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 265,
          end_tick: 400,
        }),
      ],
    });
    // The HUD renders T on the left ("name score") and CT on the right ("score name").
    const { rerender } = render(<Hud replay={replay} tick={200} />);
    expect(screen.getByText("1 Astralis")).toBeInTheDocument();
    expect(screen.getByText("Vitality 0")).toBeInTheDocument();

    // Round 13 is the second half: the team that started T is now CT.
    rerender(<Hud replay={replay} tick={300} />);
    expect(screen.getByText("Astralis 1")).toBeInTheDocument();
    expect(screen.getByText("0 Vitality")).toBeInTheDocument();
  });

  it("drops the Defuse badge after an abort and keeps the C4 clock", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks: ctSamples([
        { tick: 200, defusing: true },
        { tick: 800, defusing: true },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: 201, kind: "abort_defuse", player: 0 }),
      ],
    });
    const { rerender } = render(<Hud replay={replay} tick={200} />);
    expect(screen.getByText(/Defuse/)).toBeInTheDocument();
    expect(screen.getByText(/C4/)).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={250} />);
    expect(screen.queryByText(/Defuse/)).not.toBeInTheDocument();
    expect(screen.getByText(/C4/)).toBeInTheDocument();
  });

  it("drops the Defuse badge when the flag is gone and no abort arrives", () => {
    const begin = 200;
    const stride = 8;
    const slack = stride * 2;
    const replay = makeReplay({
      header: { tick_stride: stride },
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks: ctSamples([
        { tick: begin, defusing: false },
        { tick: begin + slack, defusing: false },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    const { rerender } = render(<Hud replay={replay} tick={begin} />);
    expect(screen.getByText(/Defuse/)).toBeInTheDocument();
    expect(screen.getByText(/C4/)).toBeInTheDocument();

    rerender(<Hud replay={replay} tick={begin + slack} />);
    expect(screen.queryByText(/Defuse/)).not.toBeInTheDocument();
    expect(screen.getByText(/C4/)).toBeInTheDocument();
  });
});
