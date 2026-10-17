/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { FULL_HEALTH, SIDEBAR_DEFAULT_WIDTH } from "@/lib/shared/constants";
import { TIMELINE_LAYOUT, axisPixel, plotRect, roundX } from "@/lib/stats/timelineChart";
import type { TimelineColumn, TimelinePlayerRow, TimelineStatId } from "@/lib/stats/timeline";
import {
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
  sampleMatchInfo,
} from "@/lib/testing/fixtures";
import { StatsTimeline } from "./StatsTimeline";
import { StatsTimelineChart } from "./StatsTimelineChart";

const MODAL_BODY_PAD_X = 0.85 * 16 * 2;

function chartCssWidth(viewport: number, sidebar: number): number {
  return viewport - sidebar - MODAL_BODY_PAD_X;
}

function swappedColumn(number: number, side: "CT" | "T"): TimelineColumn {
  const value = { round: 1, running: 1 };
  const ids: TimelineStatId[] = ["kills", "hs", "adr", "opening", "kast", "util", "flashed"];
  const values = Object.fromEntries(ids.map((id) => [id, value])) as TimelinePlayerRow["values"];
  const row = (player: number, name: string, rowSide: "CT" | "T"): TimelinePlayerRow => ({
    player,
    name,
    side: rowSide,
    present: true,
    won: null,
    buy: null,
    values,
  });
  return {
    number,
    rows: [row(0, "Alice", side), row(1, "Bob", side === "CT" ? "T" : "CT")],
    winner: null,
    winReason: 0,
    winRoster: null,
  };
}

function installPlotResize(initial: { width: number; height: number }) {
  const size = initial;
  const notify = (callback: ResizeObserverCallback, targets: readonly Element[]) => {
    for (const target of targets) {
      callback(
        [
          {
            target,
            contentRect: new DOMRect(0, 0, size.width, size.height),
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    }
  };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets: Element[] = [];
      observe!: (target: Element) => void;
      constructor(callback: ResizeObserverCallback) {
        this.observe = (target: Element) => {
          this.targets.push(target);
          notify(callback, [target]);
        };
      }
      disconnect() {
        this.targets.length = 0;
      }
    },
  );
  return {
    restore() {
      vi.unstubAllGlobals();
    },
  };
}

describe("StatsTimeline convar separators", () => {
  it("draws the regulation line from mp_maxrounds when the side does not swap", () => {
    const width = chartCssWidth(1920, SIDEBAR_DEFAULT_WIDTH);
    const plotResize = installPlotResize({ width, height: 812.5 });
    const columns = [swappedColumn(24, "CT"), swappedColumn(25, "CT")];
    try {
      const { unmount } = render(
        <StatsTimelineChart
          columns={columns}
          stat="adr"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={null}
          onSelect={() => undefined}
          onHover={() => undefined}
          matchInfo={sampleMatchInfo()}
        />,
      );
      const line = document.querySelector(".stats-timeline-break");
      const grid = document.querySelector(".stats-timeline-grid");
      expect(line?.closest(".stats-timeline-axis-svg")).not.toBeNull();
      expect(line?.closest(".stats-timeline-series")).toBeNull();
      expect(line).toHaveAttribute("stroke-width", grid?.getAttribute("stroke-width") ?? "");
      expect(line).toHaveAttribute("shape-rendering", "crispEdges");
      const plot = plotRect();
      const mid = (roundX(0, columns.length, plot) + roundX(1, columns.length, plot)) / 2;
      const snapped = String(axisPixel(mid, TIMELINE_LAYOUT.width, width));
      expect(line).toHaveAttribute("x1", snapped);
      expect(line).toHaveAttribute("x2", snapped);
      unmount();
      render(
        <StatsTimelineChart
          columns={columns}
          stat="adr"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={null}
          onSelect={() => undefined}
          onHover={() => undefined}
        />,
      );
      expect(document.querySelector(".stats-timeline-break")).toBeNull();
    } finally {
      plotResize.restore();
    }
  });

  it("draws the overtime start from the replay convar when the side does not swap", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks.set([64, 200]);
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.health[0] = FULL_HEALTH;
    ticks.health[1] = FULL_HEALTH;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      ticks,
      match_info: sampleMatchInfo(),
      rounds: [
        makeRound({
          number: 24,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 100,
          winner: "CT",
          score_ct: 12,
          score_t: 11,
        }),
        makeRound({
          number: 25,
          start_tick: 150,
          freeze_end_tick: 200,
          end_tick: 400,
          winner: "T",
          score_ct: 12,
          score_t: 12,
        }),
      ],
    });
    const plotResize = installPlotResize({
      width: chartCssWidth(1920, SIDEBAR_DEFAULT_WIDTH),
      height: 812.5,
    });
    try {
      const { unmount } = render(<StatsTimeline replay={replay} />);
      const line = document.querySelector(".stats-timeline-break");
      expect(line?.closest(".stats-timeline-axis-svg")).not.toBeNull();
      expect(line).toHaveAttribute(
        "stroke-width",
        document.querySelector(".stats-timeline-grid")?.getAttribute("stroke-width") ?? "",
      );
      unmount();
      render(<StatsTimeline replay={{ ...replay, match_info: undefined }} />);
      expect(document.querySelector(".stats-timeline-break")).toBeNull();
    } finally {
      plotResize.restore();
    }
  });
});
