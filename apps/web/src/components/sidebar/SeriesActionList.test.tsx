import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeriesActionBeatRow } from "@/lib/parse/seriesAnalysis";
import { SeriesActionList } from "./SeriesActionList";

const beat: SeriesActionBeatRow = {
  demoId: "d1",
  fileName: "a.dem",
  jumpTick: 200,
  title: "A execute",
  beat: {
    round: 1,
    roundLabel: "R1",
    kind: "execute",
    side: "T",
    tick: 200,
    actionTick: 220,
    title: "A execute",
    detail: "5 players hit site",
    site: null,
    location: "A site",
  },
};

describe("SeriesActionList", () => {
  it("lists action beats across demos", () => {
    render(<SeriesActionList beats={[beat]} onJump={() => {}} />);
    expect(screen.getByText(/Execute beats across 1 demos/)).toBeInTheDocument();
    expect(screen.getByText(/a\.dem · A execute/)).toBeInTheDocument();
  });

  it("jumps when a beat is clicked", async () => {
    const onJump = vi.fn();
    render(<SeriesActionList beats={[beat]} onJump={onJump} />);
    await userEvent.click(screen.getByRole("button", { name: /a\.dem · A execute/ }));
    expect(onJump).toHaveBeenCalledWith({ demoId: "d1", jumpTick: 200 });
  });
});
