import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCallout, makePlaces, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { Action } from "./Action";

describe("Action", () => {
  it("renders round stories for competitive rounds", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
    });
    render(<Action replay={replay} tick={200} onJump={() => {}} places={null} />);
    expect(screen.getByText(/Round story/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /R1/ })).toBeInTheDocument();
  });

  it("filters to this round when toggled", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 2,
          winner: "T",
          start_tick: 700,
          freeze_end_tick: 764,
          end_tick: 1300,
        }),
      ],
    });
    render(<Action replay={replay} tick={800} onJump={() => {}} places={null} />);
    await userEvent.click(screen.getByRole("button", { name: "This round" }));
    expect(screen.queryByRole("button", { name: /R1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /R2/ })).toBeInTheDocument();
  });

  it("jumps when a round story is clicked", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
    });
    render(<Action replay={replay} tick={200} onJump={onJump} places={null} />);
    await userEvent.click(screen.getByRole("button", { name: /R1/ }));
    expect(onJump).toHaveBeenCalledWith(64);
  });

  it("filters by side, kind, and layout group", async () => {
    const places = makePlaces([makeCallout("a", "A site", 0, 0, 100, 100)]);
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
    });
    render(<Action replay={replay} tick={200} onJump={() => {}} places={places} />);

    await userEvent.click(screen.getByRole("button", { name: "CT" }));
    await userEvent.click(screen.getByRole("button", { name: "Execute" }));
    expect(screen.getByRole("button", { name: "Execute" })).toHaveClass("on");
  });
});
