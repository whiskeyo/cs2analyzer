import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { collectSeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { SeriesAggregatedRoundStrip } from "./SeriesAggregatedRoundStrip";

function fixture() {
  const focal = "Team A";
  const replayA = makeReplay({
    header: { team_ct: focal, team_t: "B", map_name: "de_mirage" },
    ticks: makeFreezeTicks(2, 1, 64),
    rounds: [
      makeRound({
        number: 1,
        team_ct: focal,
        team_t: "B",
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 700,
      }),
    ],
  });
  const replayB = makeReplay({
    header: { team_ct: "B", team_t: focal, map_name: "de_mirage" },
    ticks: makeFreezeTicks(2, 1, 64),
    rounds: [
      makeRound({
        number: 1,
        team_ct: "B",
        team_t: focal,
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 700,
      }),
    ],
  });
  const demoA = loadedDemo(replayA, "a.dem", new File([], "a.dem"));
  const demoB = loadedDemo(replayB, "b.dem", new File([], "b.dem"));
  const series = buildSeries("de_mirage", [demoA, demoB]);
  return { groups: collectSeriesRoundsByKind(series), replay: replayA, demoA };
}

describe("SeriesAggregatedRoundStrip", () => {
  it("renders buy-type rows with CT and T chips", () => {
    const { groups, replay, demoA } = fixture();
    render(
      <SeriesAggregatedRoundStrip
        groups={groups}
        demoColors={new Map([[demoA.id, "#f00"]])}
        activeDemoId={demoA.id}
        bucketOverlay={null}
        replay={replay}
        tick={100}
        onBucketOverlay={() => {}}
        onRoundJump={() => {}}
      />,
    );
    expect(screen.getByText("Pistol")).toBeInTheDocument();
    expect(screen.getAllByTitle(/Pistol/).length).toBeGreaterThan(0);
  });

  it("calls onRoundJump when a round chip is clicked", async () => {
    const { groups, replay, demoA } = fixture();
    const onRoundJump = vi.fn();
    render(
      <SeriesAggregatedRoundStrip
        groups={groups}
        demoColors={new Map()}
        activeDemoId={demoA.id}
        bucketOverlay={null}
        replay={replay}
        tick={100}
        onBucketOverlay={() => {}}
        onRoundJump={onRoundJump}
      />,
    );
    await userEvent.click(screen.getByTitle("Pistol · CT #1"));
    expect(onRoundJump).toHaveBeenCalledWith(
      expect.objectContaining({ demoId: demoA.id, jumpTick: expect.any(Number) }),
    );
  });

  it("calls onBucketOverlay for the aggregate chip", async () => {
    const { groups, replay, demoA } = fixture();
    const onBucketOverlay = vi.fn();
    render(
      <SeriesAggregatedRoundStrip
        groups={groups}
        demoColors={new Map()}
        activeDemoId={demoA.id}
        bucketOverlay={null}
        replay={replay}
        tick={100}
        onBucketOverlay={onBucketOverlay}
        onRoundJump={() => {}}
      />,
    );
    await userEvent.click(screen.getByTitle("Pistol · CT · all rounds overlay"));
    expect(onBucketOverlay).toHaveBeenCalledWith("pistol", "CT");
  });
});
