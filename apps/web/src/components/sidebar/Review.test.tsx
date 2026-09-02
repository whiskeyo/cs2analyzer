import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { Review } from "./Review";

describe("Review", () => {
  it("asks for a player when none is selected", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={null} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Select a player/)).toBeInTheDocument();
    expect(screen.queryByText(/Won the opening/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Won the opening/)).toBeInTheDocument();
  });

  it("dims notes that have not happened yet", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(<Review replay={replay} tick={80} selected={0} onJump={() => {}} onSelect={() => {}} />);
    const rows = screen.getAllByRole("button").filter((el) => el.className.includes("review-note"));
    expect(rows.some((row) => row.className.includes("pending"))).toBe(true);
  });

  it("jumps from a player note", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(300, 1, 0)],
    });
    render(<Review replay={replay} tick={640} selected={0} onJump={onJump} onSelect={() => {}} />);

    const note = screen.getAllByRole("button").find((b) => b.className.includes("review-note"));
    expect(note).toBeDefined();
    await userEvent.click(note!);
    expect(onJump).toHaveBeenCalled();
  });
});
