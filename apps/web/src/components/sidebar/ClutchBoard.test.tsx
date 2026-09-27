/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WEAPON_BY_ID } from "@/lib/weapons/weapons";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { ClutchBoard } from "./ClutchBoard";

function clutchReplay() {
  const ticks = makeFreezeTicks(4, 2);
  ticks.active[1] = WEAPON_BY_ID.indexOf("ak47");
  ticks.x[1] = 10;
  ticks.y[1] = 20;
  return makeReplay({
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
    ticks,
    kills: [makeKill(200, 2, 0)],
  });
}

describe("ClutchBoard", () => {
  it("lists the round, scoreline, weapon, result, and tick", () => {
    render(
      <ClutchBoard
        replay={clutchReplay()}
        tick={1400}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Bob · 1v2/ })).toHaveTextContent("Won");
    expect(screen.getByRole("button", { name: /Bob · 1v2/ })).toHaveTextContent("AK-47");
    expect(screen.getByRole("button", { name: /Bob · 1v2/ })).toHaveTextContent("tick 200");
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.queryByText(/1v1/)).not.toBeInTheDocument();
  });

  it("jumps to the clutch start and selects that player", async () => {
    const onJump = vi.fn();
    const onSelect = vi.fn();
    render(
      <ClutchBoard
        replay={clutchReplay()}
        tick={1400}
        selected={null}
        onJump={onJump}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Bob · 1v2/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onJump).toHaveBeenCalledWith(200);
  });

  it("filters to losses", async () => {
    const ticks = makeFreezeTicks(5, 2);
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Bob"),
        makePlayer(2, "T", "T1"),
        makePlayer(3, "T", "T2"),
        makePlayer(4, "T", "T3"),
      ],
      rounds: [makeRound({ number: 4, winner: "T" })],
      ticks,
      kills: [makeKill(180, 2, 0)],
    });
    render(
      <ClutchBoard
        replay={replay}
        tick={640}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Bob · 1v3/ })).toHaveTextContent("Lost");
    await userEvent.click(screen.getByRole("button", { name: "Won" }));
    expect(screen.getByText("No clutches match these filters.")).toBeInTheDocument();
  });

  it("says when the match has no 1v2+", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1 })],
      kills: [makeKill(200, 0, 1)],
      ticks: makeFreezeTicks(2, 1),
    });
    render(
      <ClutchBoard
        replay={replay}
        tick={640}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("No 1v2+ clutches in this match.")).toBeInTheDocument();
  });
});
