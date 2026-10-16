import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { OpeningDuels } from "./OpeningDuels";

function replay() {
  return makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
    rounds: [
      makeRound({
        number: 1,
        winner: "CT",
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 640,
      }),
      makeRound({
        number: 2,
        winner: "T",
        start_tick: 700,
        freeze_end_tick: 760,
        end_tick: 1400,
      }),
    ],
    kills: [
      makeKill(200, 0, 1, { weapon: "ak47", headshot: true }),
      makeKill(400, 1, 0),
      makeKill(900, 1, 0, { weapon: "awp" }),
    ],
  });
}

describe("OpeningDuels", () => {
  it("lists the first kill of each round", () => {
    render(<OpeningDuels replay={replay()} tick={1400} onJump={() => {}} />);
    expect(screen.getByRole("region", { name: "Opening duels" })).toBeInTheDocument();
    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("R1");
    expect(rows[0]).toHaveTextContent("CT");
    expect(rows[0]).toHaveTextContent("Alice killed Bob");
    expect(rows[0]).toHaveTextContent("AK-47 HS");
    expect(rows[0]).toHaveTextContent("won the round");
    expect(rows[1]).toHaveTextContent("R2");
    expect(rows[1]).toHaveTextContent("T");
    expect(rows[1]).toHaveTextContent("Bob killed Alice");
    expect(rows[1]).toHaveTextContent("AWP");
    expect(rows[1]).toHaveTextContent("won the round");
    expect(rows[0]).not.toHaveTextContent("400");
  });

  it("jumps playback to the kill tick", async () => {
    const onJump = vi.fn();
    render(<OpeningDuels replay={replay()} tick={1400} onJump={onJump} />);
    await userEvent.click(screen.getByRole("button", { name: /Alice killed Bob/ }));
    expect(onJump).toHaveBeenCalledWith(200);
  });

  it("dims an opening that has not happened and highlights the live round", () => {
    const { rerender } = render(<OpeningDuels replay={replay()} tick={80} onJump={() => {}} />);
    const early = screen.getByRole("button", { name: /Alice killed Bob/ });
    expect(early.className.split(" ")).toContain("pending");
    expect(early.className.split(" ")).not.toContain("on");

    rerender(<OpeningDuels replay={replay()} tick={640} onJump={() => {}} />);
    const live = screen.getByRole("button", { name: /Alice killed Bob/ });
    expect(live.className.split(" ")).toContain("on");
    expect(live.className.split(" ")).not.toContain("pending");
    expect(screen.getByRole("button", { name: /Bob killed Alice/ }).className.split(" ")).toContain(
      "pending",
    );
  });

  it("says when the match has no opening", () => {
    render(
      <OpeningDuels
        replay={makeReplay({
          rounds: [makeRound({ number: 1, is_knife: true })],
          kills: [makeKill(20, 0, 1)],
        })}
        tick={40}
        onJump={() => {}}
      />,
    );
    expect(screen.getByText("No opening duels in this match.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
