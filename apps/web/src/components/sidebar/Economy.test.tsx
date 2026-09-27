import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ECO_MAX_EQUIPMENT, FORCE_BUY_MAX_EQUIPMENT } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { Economy } from "./Economy";

function pistolReplay() {
  const ticks = makeTicks(2, 2);
  const rounds = [1, 4].map((number, index) => {
    const start = index * 1000;
    const freeze = start + 64;
    ticks.ticks[index] = freeze;
    const base = index * 2;
    ticks.flags[base] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[base + 1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.equip[base] = number === 1 ? 800 : FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[base + 1] = number === 1 ? 800 : ECO_MAX_EQUIPMENT - 1;
    return makeRound({
      number,
      winner: "CT",
      start_tick: start,
      freeze_end_tick: freeze,
      end_tick: start + 800,
    });
  });
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [makePlayer(0, "CT", "C"), makePlayer(1, "T", "T")],
    rounds,
    ticks,
  });
}

describe("Economy", () => {
  it("charts buy types and win rates, and jumps to freeze end", async () => {
    const onJump = vi.fn();
    render(<Economy replay={pistolReplay()} tick={100} onJump={onJump} />);

    expect(screen.getByRole("heading", { name: "Economy" })).toBeInTheDocument();
    expect(screen.getAllByText("Astralis").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Anti-eco").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);

    const cell = screen.getByRole("button", {
      name: /Round 4 · Astralis \(CT\) · Anti-eco/,
    });
    expect(cell).toHaveClass("win");
    await userEvent.click(cell);
    expect(onJump).toHaveBeenCalledWith(1064);
  });

  it("marks the live round", () => {
    render(
      <Economy
        replay={pistolReplay()}
        tick={100}
        onJump={() => {}}
        activeRound={pistolReplay().rounds[0]}
      />,
    );
    expect(screen.getByRole("button", { name: /Round 1 · Astralis/ })).toHaveClass("on");
  });

  it("says when the match has no competitive rounds", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 0, is_knife: true, winner: "T" })],
    });
    render(<Economy replay={replay} tick={0} onJump={() => {}} />);
    expect(screen.getByText("No competitive rounds to chart.")).toBeInTheDocument();
  });
});
