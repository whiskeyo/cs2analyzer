import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HITGROUP_HEAD } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeHurt,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { SpectatorEconomy } from "./SpectatorEconomy";

function replay() {
  const ticks = makeFreezeTicks(4, 2, 64);
  ticks.money[0] = 4200;
  ticks.money[1] = 3800;
  ticks.money[2] = 2400;
  ticks.money[3] = 1900;
  ticks.equip[0] = 5000;
  ticks.equip[2] = 3200;
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    ticks,
  });
}

describe("SpectatorEconomy", () => {
  it("shows both team columns with player names", () => {
    render(<SpectatorEconomy replay={replay()} tick={64} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Vitality · 2")).toBeInTheDocument();
    expect(screen.getByText("Astralis · 2")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();
  });

  it("selects and deselects a player card", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <SpectatorEconomy replay={replay()} tick={64} selected={null} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByText("Alice").closest("button") as HTMLButtonElement);
    expect(onSelect).toHaveBeenCalledWith(0);

    rerender(<SpectatorEconomy replay={replay()} tick={64} selected={0} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Alice").closest("button") as HTMLButtonElement);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("marks the selected card", () => {
    render(<SpectatorEconomy replay={replay()} tick={64} selected={2} onSelect={() => {}} />);
    expect(screen.getByText("Cara").closest(".spec-card")).toHaveClass("on");
  });

  it("shows last hit on the selected card only", () => {
    const m = replay();
    m.hurts = [makeHurt(64, 2, 0, 89, { hitgroup: HITGROUP_HEAD, damage_armor: 15 })];
    const { rerender } = render(
      <SpectatorEconomy replay={m} tick={64} selected={0} onSelect={() => {}} />,
    );
    expect(screen.getByText("Last hit: head \u221289 (armor \u221215)")).toBeInTheDocument();
    rerender(<SpectatorEconomy replay={m} tick={64} selected={null} onSelect={() => {}} />);
    expect(screen.queryByText(/Last hit:/)).not.toBeInTheDocument();
  });

  it("highlights the weapon in hand", () => {
    const m = replay();
    m.ticks.primary[2] = 23;
    m.ticks.secondary[2] = 4;
    m.ticks.active[2] = 1;
    render(<SpectatorEconomy replay={m} tick={64} selected={null} onSelect={() => {}} />);
    expect(screen.getByTitle("Knife")).toHaveClass("held");
    expect(screen.getByTitle("AK-47")).toHaveClass("stowed");
  });

  it("shows clip and reserve for the held gun", () => {
    const m = replay();
    m.ticks.primary[2] = 23;
    m.ticks.active[2] = 23;
    m.ticks.clip[2] = 24;
    m.ticks.reserve[2] = 90;
    render(<SpectatorEconomy replay={m} tick={64} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("24/90")).toBeInTheDocument();
  });
});
