import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { Scoreboard } from "./Scoreboard";

/** Two CTs and two Ts, all alive at freeze, with one CT frag on the board. */
function replay() {
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
    ticks: makeFreezeTicks(4, 2),
    kills: [makeKill(200, 0, 2)],
  });
}

function teamTable(name: string): HTMLElement {
  const head = screen.getByText(name);
  const team = head.closest(".sb-team");
  if (!team) throw new Error(`no team block for ${name}`);
  return team as HTMLElement;
}

describe("Scoreboard", () => {
  it("groups players under the side they are on at this tick", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={null} onSelect={() => {}} />);

    const ct = teamTable("Astralis");
    expect(within(ct).getByText("Alice")).toBeInTheDocument();
    expect(within(ct).getByText("Bob")).toBeInTheDocument();
    expect(within(ct).queryByText("Cara")).not.toBeInTheDocument();

    const t = teamTable("Vitality");
    expect(within(t).getByText("Cara")).toBeInTheDocument();
    expect(within(t).getByText("Dan")).toBeInTheDocument();
  });

  it("reports the kill and the entry frag for the opener", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={0} onSelect={() => {}} />);

    const detail = screen.getByRole("heading", { name: "Alice" }).closest(".detail");
    expect(detail).not.toBeNull();
    expect(within(detail as HTMLElement).getByText("1 / 0 / 0 (1.00)")).toBeInTheDocument();
    // Alice won the only opening duel of the round.
    expect(within(detail as HTMLElement).getByText(/1 \/ 0 · 100% entry/)).toBeInTheDocument();
  });

  it("selects a player when their row is clicked", async () => {
    const onSelect = vi.fn();
    render(<Scoreboard replay={replay()} tick={640} selected={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Cara"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("marks the selected row so the radar and table stay in sync", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={1} onSelect={() => {}} />);

    // "Bob" also appears as the detail heading, so look inside the CT table.
    const ct = teamTable("Astralis");
    expect(within(ct).getByText("Bob").closest("tr")).toHaveClass("selected");
    expect(within(ct).getByText("Alice").closest("tr")).not.toHaveClass("selected");
  });
});
