import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeriesRoundChip, SeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import { collectSeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import type { RoundKind } from "@/lib/parse/roundTags";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX } from "@/lib/shared/constants";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import type { Side } from "@/lib/replay/replayTypes";
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

  it("disables unused buckets and numbered chips for the tutorial lock", async () => {
    const { groups, replay, demoA } = fixture();
    const onBucketOverlay = vi.fn();
    const onRoundJump = vi.fn();
    render(
      <SeriesAggregatedRoundStrip
        groups={groups}
        demoColors={new Map()}
        activeDemoId={demoA.id}
        bucketOverlay={{ kind: "full", side: "CT" }}
        replay={replay}
        tick={100}
        onBucketOverlay={onBucketOverlay}
        onRoundJump={onRoundJump}
        bucketEnabled={(kind) => kind === "full"}
        roundJumpEnabled={false}
      />,
    );
    const pistolBucket = screen.getByTitle("Pistol · CT · not playable in the tutorial");
    expect(pistolBucket).toBeDisabled();
    expect(pistolBucket).toHaveClass("is-inactive");
    const numbered = screen.getByTitle("Pistol · CT #1 · not playable in the tutorial");
    expect(numbered).toBeDisabled();
    await userEvent.click(pistolBucket);
    await userEvent.click(numbered);
    expect(onBucketOverlay).not.toHaveBeenCalled();
    expect(onRoundJump).not.toHaveBeenCalled();
  });
});

function roundsOf(kind: RoundKind, side: Side, count: number): SeriesRoundChip[] {
  const demoId = side === "CT" ? "ct-demo" : "t-demo";
  return Array.from({ length: count }, (_, index) => ({
    demoId,
    roundNumber: index + 1,
    kind,
    side,
    jumpTick: (index + 1) * 64,
    indexInKind: index + 1,
  }));
}

function kindGroup(kind: RoundKind, label: string, ct: number, t: number): SeriesRoundsByKind {
  return { kind, label, rounds: [...roundsOf(kind, "CT", ct), ...roundsOf(kind, "T", t)] };
}

function lineSides(track: HTMLElement): string[] {
  return [...track.children]
    .filter((node) => node.classList.contains("series-round-line"))
    .map((line) => line.getAttribute("data-side") ?? "");
}

function installResizeObserver() {
  const instances: { callback: ResizeObserverCallback }[] = [];
  class Observer {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      const index = instances.indexOf(this);
      if (index >= 0) instances.splice(index, 1);
    }
  }
  vi.stubGlobal("ResizeObserver", Observer);
  return {
    flush() {
      for (const instance of [...instances]) {
        instance.callback([], instance as unknown as ResizeObserver);
      }
    },
  };
}

function trackFor(label: string): HTMLElement {
  const track = screen.getByRole("group", { name: `${label} rounds` });
  if (!(track instanceof HTMLElement)) throw new Error(`missing track for ${label}`);
  return track;
}

function setTrackSize(label: string, available: number, needed: number) {
  const track = trackFor(label);
  const measure = track.querySelector("[data-measure]");
  if (!(measure instanceof HTMLElement)) throw new Error(`missing measure for ${label}`);
  Object.defineProperty(track, "clientWidth", { configurable: true, value: available });
  Object.defineProperty(measure, "scrollWidth", { configurable: true, value: needed });
  return track;
}

describe("aggregated round row overflow", () => {
  const resize = installResizeObserver();

  async function apply() {
    await act(async () => {
      resize.flush();
    });
  }

  function renderGroups(groups: SeriesRoundsByKind[], onRoundJump = vi.fn()) {
    const { replay, demoA } = fixture();
    render(
      <SeriesAggregatedRoundStrip
        groups={groups}
        demoColors={new Map([[demoA.id, "#f00"]])}
        activeDemoId={demoA.id}
        bucketOverlay={null}
        replay={replay}
        tick={100}
        onBucketOverlay={() => {}}
        onRoundJump={onRoundJump}
      />,
    );
    return onRoundJump;
  }

  it("splits an overflowing row into a CT line then a T line", async () => {
    const onRoundJump = renderGroups([kindGroup("full", "Full", 3, 2)]);
    setTrackSize("Full", 200, 800);
    await apply();

    const track = trackFor("Full");
    expect(track).toHaveAttribute("data-split", "true");
    expect(lineSides(track)).toEqual(["CT", "T"]);
    const [ctLine, tLine] = [...track.children].filter((node) =>
      node.classList.contains("series-round-line"),
    );
    expect(ctLine).toBeInstanceOf(HTMLElement);
    expect(tLine).toBeInstanceOf(HTMLElement);
    expect(within(ctLine as HTMLElement).getByTitle("Full · CT #1")).toBeInTheDocument();
    expect(within(ctLine as HTMLElement).getByTitle("Full · CT #3")).toBeInTheDocument();
    expect(
      within(ctLine as HTMLElement).getByTitle("Full · CT · all rounds overlay"),
    ).toBeInTheDocument();
    expect(within(tLine as HTMLElement).getByTitle("Full · T #1")).toBeInTheDocument();
    expect(within(tLine as HTMLElement).getByTitle("Full · T #2")).toBeInTheDocument();
    expect(within(ctLine as HTMLElement).queryByTitle("Full · T #1")).not.toBeInTheDocument();
    expect(track.closest(".series-round-row")).toHaveClass("is-split");

    await userEvent.click(within(tLine as HTMLElement).getByTitle("Full · T #2"));
    expect(onRoundJump).toHaveBeenCalledWith({ demoId: "t-demo", jumpTick: 128 });
  });

  it("keeps one line when the chips fit", async () => {
    renderGroups([kindGroup("full", "Full", 2, 2)]);
    setTrackSize("Full", 800, 200);
    await apply();

    const track = trackFor("Full");
    expect(track).toHaveAttribute("data-split", "false");
    expect(lineSides(track)).toEqual([]);
    expect(track.closest(".series-round-row")).not.toHaveClass("is-split");
    expect(within(track).getByTitle("Full · CT #1")).toBeInTheDocument();
    expect(within(track).getByTitle("Full · T #2")).toBeInTheDocument();
  });

  it("decides each buy row on its own", async () => {
    renderGroups([kindGroup("pistol", "Pistol", 1, 1), kindGroup("full", "Full", 4, 4)]);
    setTrackSize("Pistol", 600, 120);
    setTrackSize("Full", 180, 900);
    await apply();

    const pistol = trackFor("Pistol");
    const full = trackFor("Full");
    expect(pistol).toHaveAttribute("data-split", "false");
    expect(lineSides(pistol)).toEqual([]);
    expect(within(pistol).getByTitle("Pistol · CT #1")).toBeInTheDocument();
    expect(within(pistol).getByTitle("Pistol · T #1")).toBeInTheDocument();
    expect(full).toHaveAttribute("data-split", "true");
    expect(lineSides(full)).toEqual(["CT", "T"]);
  });

  it("does not unsplit until the track clears the hysteresis slack", async () => {
    const needed = 400;
    renderGroups([kindGroup("eco", "Eco", 2, 2)]);
    setTrackSize("Eco", 100, needed);
    await apply();
    expect(trackFor("Eco")).toHaveAttribute("data-split", "true");

    setTrackSize("Eco", needed + AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX - 1, needed);
    await apply();
    expect(trackFor("Eco")).toHaveAttribute("data-split", "true");
    expect(lineSides(trackFor("Eco"))).toEqual(["CT", "T"]);

    setTrackSize("Eco", needed + AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX, needed);
    await apply();
    expect(trackFor("Eco")).toHaveAttribute("data-split", "false");
    expect(lineSides(trackFor("Eco"))).toEqual([]);
  });
});
