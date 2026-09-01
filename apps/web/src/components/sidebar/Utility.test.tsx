import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeGrenade, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { Utility } from "./Utility";

describe("Utility", () => {
  it("shows thrown nades through the current tick", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      grenades: [makeGrenade({ kind: "smoke", thrower: 0, start_tick: 100 })],
    });
    render(
      <Utility
        replay={replay}
        tick={200}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
        places={null}
      />,
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/1 thrown/)).toBeInTheDocument();
  });

  it("jumps and selects the thrower when a row is clicked", async () => {
    const onJump = vi.fn();
    const onSelect = vi.fn();
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
        places={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Alice/ }));
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
});
