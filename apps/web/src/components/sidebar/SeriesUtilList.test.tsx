import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeriesUtilThrow } from "@/lib/parse/seriesAnalysis";
import { SeriesUtilList } from "./SeriesUtilList";

const row: SeriesUtilThrow = {
  demoId: "d1",
  fileName: "a.dem",
  jumpTick: 100,
  tick: 100,
  detonateTick: 120,
  endTick: 1200,
  round: 1,
  thrower: 0,
  throwerName: "Alice",
  kind: "smoke",
  roundLabel: "R1",
  location: "A site",
  site: null,
  inSite: true,
  blinds: [],
  hits: [],
};

describe("SeriesUtilList", () => {
  it("shows summary and util rows", () => {
    render(<SeriesUtilList rows={[row]} playerName="Alice" onJump={() => {}} />);
    expect(screen.getByText(/1 thrown across 1 demos/)).toBeInTheDocument();
    expect(screen.getByText(/a\.dem · Alice · A site/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /a\.dem · Alice/ })).not.toHaveClass("good");
  });

  it("calls onJump when a row is clicked", async () => {
    const onJump = vi.fn();
    const onClearFollow = vi.fn();
    render(
      <SeriesUtilList
        rows={[row]}
        playerName={null}
        onJump={onJump}
        onClearFollow={onClearFollow}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /a\.dem · Alice/ }));
    expect(onClearFollow).toHaveBeenCalled();
    expect(onJump).toHaveBeenCalledWith({ demoId: "d1", jumpTick: 100 });
  });

  it("shows HE hits as Enemy and Team chips like flashes", () => {
    render(
      <SeriesUtilList
        rows={[
          {
            ...row,
            kind: "he",
            hits: [
              { victim: 1, victimName: "Bob", damage: 42, enemy: true },
              { victim: 2, victimName: "Dave", damage: 7, enemy: false },
            ],
          },
        ]}
        playerName="Alice"
        onJump={() => {}}
      />,
    );
    expect(screen.queryByText(/Bob \(42\), Dave \(7\)/)).not.toBeInTheDocument();
    expect(screen.getByText("Enemy")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("Team")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("Bob (42)")).toHaveClass("util-throw-chip", "enemy");
    expect(screen.getByText("Dave (7)")).toHaveClass("util-throw-chip", "team");
  });

  it("marks a teamflash red", () => {
    render(
      <SeriesUtilList
        rows={[
          {
            ...row,
            kind: "flash",
            inSite: true,
            blinds: [{ victim: 1, victimName: "Bob", duration: 1.2, enemy: false }],
          },
        ]}
        playerName="Alice"
        onJump={() => {}}
      />,
    );
    const note = screen.getByRole("button", { name: /a\.dem · Alice/ });
    expect(note).toHaveClass("high");
    expect(note).not.toHaveClass("good");
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Bob 1.2s")).toBeInTheDocument();
  });
});
