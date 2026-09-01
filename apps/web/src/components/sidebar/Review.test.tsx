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
import { Review } from "./Review";

describe("Review", () => {
  it("shows match highlights when no player is selected", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Ace"), makePlayer(1, "T", "One"), makePlayer(2, "T", "Two")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: makeFreezeTicks(3, 1, 64),
      kills: [makeKill(200, 1, 0), makeKill(300, 2, 0), makeKill(400, 0, 1), makeKill(500, 0, 2)],
    });
    render(
      <Review replay={replay} tick={2000} selected={null} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Match highlights/)).toBeInTheDocument();
  });

  it("shows player-specific review when selected", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review filters" })).toBeInTheDocument();
  });

  it("activates the good-only filter", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Good" }));
    expect(screen.getByRole("button", { name: "Good" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "All" })).not.toHaveClass("on");
  });

  it("filters bad notes and jumps from a headline", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(300, 1, 0)],
    });
    render(<Review replay={replay} tick={640} selected={0} onJump={onJump} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Bad" }));
    expect(screen.getByRole("button", { name: "Bad" })).toHaveClass("on");

    const headline = screen.getAllByRole("button").find((b) => b.className.includes("review-note"));
    if (headline) {
      await userEvent.click(headline);
      expect(onJump).toHaveBeenCalled();
    }
  });
});
