import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UtilThrowRow } from "@/lib/match/utility";
import { UtilThrowDetail } from "./UtilThrowDetail";

function row(partial: Partial<UtilThrowRow>): UtilThrowRow {
  return {
    tick: 100,
    detonateTick: 120,
    endTick: 180,
    round: 8,
    roundLabel: "R8",
    kind: "flash",
    thrower: 0,
    throwerName: "AdaskoBlyat",
    site: "B",
    location: "Back of B",
    inSite: false,
    blinds: [],
    hits: [],
    ...partial,
  };
}

describe("UtilThrowDetail", () => {
  it("returns nothing when the throw hit nobody", () => {
    const { container } = render(<UtilThrowDetail row={row({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("splits mixed blinds into Enemy and Team chip rows", () => {
    render(
      <UtilThrowDetail
        row={row({
          blinds: [
            { victim: 1, victimName: "burazer04", duration: 0.9, enemy: true },
            { victim: 2, victimName: "Bricaa", duration: 3.1, enemy: true },
            { victim: 3, victimName: "Kiflicarr", duration: 2.9, enemy: true },
            { victim: 4, victimName: "Olivvekx", duration: 1.8, enemy: false },
            { victim: 5, victimName: "Mattiii", duration: 0.7, enemy: false },
          ],
        })}
      />,
    );

    expect(screen.queryByText(/Enemy:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Team:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/burazer04 0\.9s · Bricaa 3\.1s|Enemy: burazer04/),
    ).not.toBeInTheDocument();

    expect(screen.getByText("Enemy")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("Team")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("burazer04 0.9s")).toHaveClass("util-throw-chip", "enemy");
    expect(screen.getByText("Bricaa 3.1s")).toHaveClass("util-throw-chip", "enemy");
    expect(screen.getByText("Olivvekx 1.8s")).toHaveClass("util-throw-chip", "team");
    expect(screen.getByText("Mattiii 0.7s")).toHaveClass("util-throw-chip", "team");
  });

  it("labels a one-sided flash so the side is still obvious", () => {
    render(
      <UtilThrowDetail
        row={row({
          blinds: [{ victim: 1, victimName: "Bob", duration: 1.2, enemy: true }],
        })}
      />,
    );
    expect(screen.getByText("Enemy")).toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.getByText("Bob 1.2s")).toBeInTheDocument();
  });

  it("splits HE hits into Enemy and Team chips like flashes", () => {
    render(
      <UtilThrowDetail
        row={row({
          kind: "he",
          hits: [
            { victim: 1, victimName: "Bob", damage: 13, enemy: true },
            { victim: 2, victimName: "Dave", damage: 55, enemy: true },
            { victim: 0, victimName: "Alice", damage: 8, enemy: false },
          ],
        })}
      />,
    );
    expect(screen.queryByText(/Bob \(13\), Dave \(55\)/)).not.toBeInTheDocument();
    expect(screen.getByText("Enemy")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("Team")).toHaveClass("util-throw-kicker");
    expect(screen.getByText("Bob (13)")).toHaveClass("util-throw-chip", "enemy");
    expect(screen.getByText("Dave (55)")).toHaveClass("util-throw-chip", "enemy");
    expect(screen.getByText("Alice (8)")).toHaveClass("util-throw-chip", "team");
  });

  it("labels a one-sided molly the same way as a one-sided flash", () => {
    render(
      <UtilThrowDetail
        row={row({
          kind: "molotov",
          hits: [{ victim: 1, victimName: "Bob", damage: 22, enemy: true }],
        })}
      />,
    );
    expect(screen.getByText("Enemy")).toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.getByText("Bob (22)")).toHaveClass("util-throw-chip", "enemy");
  });
});
