import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { Clutch } from "./Clutch";

describe("Clutch", () => {
  it("filters clutch attempts by outcome", async () => {
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Ace"),
        makePlayer(1, "T", "One"),
        makePlayer(2, "T", "Two"),
        makePlayer(3, "T", "Three"),
      ],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: makeFreezeTicks(4, 1, 64),
      kills: [makeKill(200, 1, 0), makeKill(300, 2, 0), makeKill(400, 0, 1), makeKill(500, 0, 2)],
    });
    render(
      <Clutch replay={replay} tick={2000} selected={null} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/1vX attempts/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Won" }));
    expect(screen.getByText(/1\/1 won/)).toBeInTheDocument();
  });

  it("scopes rows to the selected player", async () => {
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Ace"),
        makePlayer(1, "CT", "Mate"),
        makePlayer(2, "T", "One"),
        makePlayer(3, "T", "Two"),
      ],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: makeFreezeTicks(4, 2, 64),
      kills: [makeKill(200, 2, 0), makeKill(300, 3, 1), makeKill(400, 0, 2), makeKill(500, 0, 3)],
    });
    render(
      <Clutch replay={replay} tick={2000} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Showing Ace/)).toBeInTheDocument();
    expect(screen.queryByText(/Mate 1v/)).not.toBeInTheDocument();
  });

  it("filters lost clutches and jumps from a row", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Ace"), makePlayer(1, "T", "One"), makePlayer(2, "T", "Two")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: makeFreezeTicks(3, 1, 64),
      kills: [makeKill(200, 1, 0), makeKill(300, 2, 0)],
    });
    render(
      <Clutch replay={replay} tick={2000} selected={null} onJump={onJump} onSelect={() => {}} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Lost" }));
    expect(screen.getByText(/0\/1 won/)).toBeInTheDocument();

    const row = screen.getAllByRole("button").find((btn) => btn.textContent?.includes("Ace"));
    expect(row).toBeDefined();
    await userEvent.click(row!);
    expect(onJump).toHaveBeenCalled();
  });
});
