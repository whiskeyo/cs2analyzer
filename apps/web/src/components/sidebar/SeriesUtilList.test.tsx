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
  });

  it("calls onJump when a row is clicked", async () => {
    const onJump = vi.fn();
    render(<SeriesUtilList rows={[row]} playerName={null} onJump={onJump} />);
    await userEvent.click(screen.getByRole("button", { name: /a\.dem · Alice/ }));
    expect(onJump).toHaveBeenCalledWith({ demoId: "d1", jumpTick: 100 });
  });
});
