import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { RoundList } from "./RoundList";

describe("RoundList", () => {
  it("lists rounds with scores and event counts", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          score_ct: 1,
          score_t: 0,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(<RoundList replay={replay} tick={300} onJump={() => {}} onSelect={() => {}} />);
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText(/1k/)).toBeInTheDocument();
  });

  it("expands to show kill events", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(<RoundList replay={replay} tick={300} onJump={() => {}} onSelect={() => {}} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("jumps to freeze end when the round row is clicked", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    render(<RoundList replay={replay} tick={100} onJump={onJump} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /R1/ }));
    expect(onJump).toHaveBeenCalledWith(64);
  });

  it("writes lead-in through the settings callback", async () => {
    const onLeadInSecChange = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    render(
      <RoundList
        replay={replay}
        tick={100}
        onJump={() => {}}
        onSelect={() => {}}
        leadInSec={1.5}
        onLeadInSecChange={onLeadInSecChange}
      />,
    );
    const input = screen.getByLabelText(/Lead-in/);
    fireEvent.change(input, { target: { value: "3" } });
    expect(onLeadInSecChange).toHaveBeenCalledWith(3);
  });

  it("collapses an expanded round", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(<RoundList replay={replay} tick={300} onJump={() => {}} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Collapse round" }));
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("keeps the pinned round current when the tick is still in the previous round", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 18,
          start_tick: 6000,
          freeze_end_tick: 7064,
          end_tick: 8900,
        }),
        makeRound({
          number: 19,
          start_tick: 7000,
          freeze_end_tick: 9064,
          end_tick: 9900,
        }),
      ],
    });
    render(
      <RoundList
        replay={replay}
        tick={6999}
        onJump={() => {}}
        onSelect={() => {}}
        activeRound={replay.rounds[1]}
      />,
    );
    const current = screen.getByRole("button", { name: /R19/ });
    expect(current.className).toContain("on");
    expect(screen.getByRole("button", { name: /R18/ }).className).not.toContain("on");
  });
});
