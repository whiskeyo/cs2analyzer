import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeBlind, makeGrenade, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { Utility } from "./Utility";

describe("Utility", () => {
  it("lists the whole match and dims nades that have not been thrown yet", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      grenades: [makeGrenade({ kind: "smoke", thrower: 0, start_tick: 100 })],
    });
    const { rerender } = render(
      <Utility
        replay={replay}
        tick={50}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
        places={null}
      />,
    );
    expect(screen.getByText(/1 thrown/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alice/ })).toHaveClass("pending");

    rerender(
      <Utility
        replay={replay}
        tick={200}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
        places={null}
      />,
    );
    expect(screen.getByRole("button", { name: /Alice/ })).not.toHaveClass("pending");
  });

  it("jumps and selects the thrower when a row is clicked", async () => {
    const onJump = vi.fn();
    const onSelect = vi.fn();
    const onClearFollow = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      grenades: [makeGrenade({ kind: "flash", thrower: 0, start_tick: 100 })],
    });
    render(
      <Utility
        replay={replay}
        tick={200}
        selected={null}
        onJump={onJump}
        onSelect={onSelect}
        onClearFollow={onClearFollow}
        places={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Alice/ }));
    expect(onClearFollow).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onJump).toHaveBeenCalledWith(100);
  });

  it("filters by nade kind", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      grenades: [
        makeGrenade({ kind: "smoke", thrower: 0, start_tick: 100 }),
        makeGrenade({ kind: "flash", thrower: 0, start_tick: 120 }),
      ],
    });
    render(
      <Utility
        replay={replay}
        tick={200}
        selected={0}
        onJump={() => {}}
        onSelect={() => {}}
        places={null}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Flash" }));
    expect(screen.getByRole("button", { name: "Flash" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Show all nade types" }));
    expect(screen.getByRole("button", { name: "Flash" })).not.toHaveClass("on");
  });

  it("colours flash rows by enemy, team, and mixed blinds", () => {
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Bob"),
        makePlayer(2, "T", "Dave"),
      ],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      grenades: [
        makeGrenade({
          kind: "flash",
          thrower: 0,
          start_tick: 100,
          detonate_tick: 120,
          end_tick: 180,
        }),
        makeGrenade({
          kind: "flash",
          thrower: 0,
          start_tick: 200,
          detonate_tick: 220,
          end_tick: 280,
        }),
        makeGrenade({
          kind: "flash",
          thrower: 0,
          start_tick: 300,
          detonate_tick: 320,
          end_tick: 380,
        }),
      ],
      blinds: [
        makeBlind(120, 0, 1, 1.2),
        makeBlind(220, 0, 0, 1.1),
        makeBlind(320, 0, 1, 0.9),
        makeBlind(322, 0, 0, 0.8),
      ],
    });
    render(
      <Utility
        replay={replay}
        tick={400}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
        places={null}
      />,
    );
    const rows = screen.getAllByRole("button").filter((el) => el.className.includes("review-note"));
    expect(rows[0]).toHaveClass("good");
    expect(rows[1]).toHaveClass("high");
    expect(rows[2]).toHaveClass("mixed");
    expect(screen.getByText("Bob 1.2s")).toBeInTheDocument();
    expect(screen.getByText("Alice 1.1s")).toBeInTheDocument();
    expect(screen.getByText("Bob 0.9s")).toBeInTheDocument();
    expect(screen.getByText("Alice 0.8s")).toBeInTheDocument();
    expect(screen.queryByText(/Enemy: Bob 0\.9s · Team: Alice 0\.8s/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Enemy")).toHaveLength(2);
    expect(screen.getAllByText("Team")).toHaveLength(2);
  });
});
