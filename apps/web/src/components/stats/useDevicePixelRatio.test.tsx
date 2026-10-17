/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { TimelineColumn, TimelinePlayerRow, TimelineStatId } from "@/lib/stats/timeline";
import { axisStrokeWidth, roundLabelGapPx } from "@/lib/stats/timelineChart";
import { StatsTimelineChart } from "./StatsTimelineChart";

function column(number: number): TimelineColumn {
  const value = { round: 1, running: 1 };
  const ids: TimelineStatId[] = ["kills", "hs", "adr", "opening", "kast", "util", "flashed"];
  const values = Object.fromEntries(ids.map((id) => [id, value])) as TimelinePlayerRow["values"];
  const row = (player: number, side: "CT" | "T"): TimelinePlayerRow => ({
    player,
    name: player === 0 ? "Alice" : "Bob",
    side,
    present: true,
    won: null,
    buy: null,
    values,
  });
  return {
    number,
    rows: [row(0, "CT"), row(1, "T")],
    winner: null,
    winReason: 0,
    winRoster: null,
  };
}

function labelGap(): number {
  const label = document.querySelector(".stats-timeline-round-label");
  const baselineY = Math.max(
    ...[...document.querySelectorAll(".stats-timeline-grid")]
      .filter((line) => line.getAttribute("y1") === line.getAttribute("y2"))
      .map((line) => Number(line.getAttribute("y1"))),
  );
  return label instanceof HTMLElement ? Number.parseFloat(label.style.top) - baselineY : NaN;
}

describe("useDevicePixelRatio", () => {
  it("updates the round-label gap and grid stroke when the resolution query changes", () => {
    const width = 1400;
    const height = 800;
    let ratio = 1;
    let listener: (() => void) | undefined;
    const previous = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      get: () => ratio,
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === `(resolution: ${ratio}dppx)`,
      media: query,
      addEventListener: (_type: string, cb: () => void) => {
        listener = cb;
      },
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          this.callback(
            [{ target, contentRect: new DOMRect(0, 0, width, height) } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, width, height),
    );
    try {
      render(
        <StatsTimelineChart
          columns={[column(1), column(2), column(3)]}
          stat="adr"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={null}
          onSelect={() => undefined}
          onHover={() => undefined}
        />,
      );
      expect(labelGap()).toBeCloseTo(5, 6);
      for (const next of [1.25, 1.5, 2]) {
        ratio = next;
        act(() => listener?.());
        expect(labelGap()).toBeCloseTo(roundLabelGapPx(next), 6);
        expect(document.querySelector(".stats-timeline-grid")).toHaveAttribute(
          "stroke-width",
          String(axisStrokeWidth(next)),
        );
      }
      expect(labelGap()).toBeCloseTo(roundLabelGapPx(2), 6);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      if (previous) Object.defineProperty(window, "devicePixelRatio", previous);
    }
  });
});
