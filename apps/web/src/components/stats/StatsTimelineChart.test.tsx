/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/shared/constants";
import type { TimelineColumn, TimelinePlayerRow, TimelineStatId } from "@/lib/stats/timeline";
import { axisStrokeWidth, devicePixelStroke, pixelOriginShift } from "@/lib/stats/timelineChart";
import { StatsTimelineChart } from "./StatsTimelineChart";

const MODAL_BODY_PAD_X = 0.85 * 16 * 2;

function chartCssWidth(viewport: number, sidebar: number): number {
  return viewport - sidebar - MODAL_BODY_PAD_X;
}

function column(number: number, side: "CT" | "T"): TimelineColumn {
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
  let size = initial;
  const listeners: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
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
        listeners.push({ callback, targets: this.targets });
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
    resize(next: { width: number; height: number }) {
      size = next;
      act(() => {
        for (const listener of listeners) notify(listener.callback, listener.targets);
      });
    },
    restore() {
      vi.unstubAllGlobals();
    },
  };
}

function expectPixelCenter(line: Element) {
  for (const name of ["x1", "y1", "x2", "y2"]) {
    expect(line.getAttribute(name)).toMatch(/\.5$/);
  }
}

/** Horizontal and vertical rules share one integer device-pixel stroke. */
function expectSharedDeviceStroke(dpr: number) {
  const lines = [
    ...document.querySelectorAll(
      ".stats-timeline-grid, .stats-timeline-break, .stats-timeline-hover",
    ),
  ];
  const vertical = lines.filter((line) => line.getAttribute("x1") === line.getAttribute("x2"));
  const horizontal = lines.filter((line) => line.getAttribute("y1") === line.getAttribute("y2"));
  expect(vertical.length).toBeGreaterThan(0);
  expect(horizontal.length).toBeGreaterThan(0);
  const width = vertical[0]?.getAttribute("stroke-width");
  expect(width).toBeTruthy();
  for (const line of [...vertical, ...horizontal]) {
    expect(line).toHaveAttribute("stroke-width", width ?? "");
  }
  const device = Number(width) * dpr;
  expect(device).toBeCloseTo(devicePixelStroke(dpr), 6);
  expect(device).toBeCloseTo(Math.round(device), 6);
  const odd = devicePixelStroke(dpr) % 2 === 1;
  for (const line of [...vertical, ...horizontal]) {
    for (const name of ["x1", "y1", "x2", "y2"]) {
      const center = Number(line.getAttribute(name)) * dpr;
      expect(center - Math.floor(center)).toBeCloseTo(odd ? 0.5 : 0, 5);
    }
  }
}

describe("StatsTimelineChart pixel grid", () => {
  it("snaps every grid rule to a pixel center at each sidebar and viewport width", () => {
    const height = 812.5;
    const widths = [
      chartCssWidth(1920, SIDEBAR_MIN_WIDTH),
      chartCssWidth(1920, SIDEBAR_DEFAULT_WIDTH),
      chartCssWidth(1920, SIDEBAR_MAX_WIDTH),
      chartCssWidth(2560, SIDEBAR_DEFAULT_WIDTH),
    ];
    const plotResize = installPlotResize({ width: widths[0] ?? 0, height });
    try {
      render(
        <StatsTimelineChart
          columns={[column(12, "CT"), column(13, "T"), column(14, "T")]}
          stat="hs"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={0}
          onSelect={() => undefined}
          onHover={() => undefined}
        />,
      );
      const verticalXs: string[] = [];
      for (const width of widths) {
        plotResize.resize({ width, height });
        const overlay = document.querySelector(".stats-timeline-axis-svg");
        expect(overlay).toHaveAttribute("viewBox", `0 0 ${width} ${height}`);
        expect(overlay).not.toHaveAttribute("preserveAspectRatio");
        const grids = [...document.querySelectorAll(".stats-timeline-grid")];
        const vertical = grids.filter(
          (line) => line.getAttribute("x1") === line.getAttribute("x2"),
        );
        const horizontal = grids.filter(
          (line) => line.getAttribute("y1") === line.getAttribute("y2"),
        );
        expect(vertical.length).toBeGreaterThan(0);
        expect(horizontal.length).toBeGreaterThan(0);
        for (const line of [
          ...grids,
          ...document.querySelectorAll(".stats-timeline-break, .stats-timeline-hover"),
        ]) {
          expectPixelCenter(line);
        }
        verticalXs.push(vertical[0]?.getAttribute("x1") ?? "");
      }
      expect(new Set(verticalXs).size).toBe(widths.length);
    } finally {
      plotResize.restore();
    }
  });

  it("shifts a fractional plot origin onto a pixel boundary without moving rules off .5", () => {
    const width = chartCssWidth(1920, SIDEBAR_MIN_WIDTH);
    const height = 812.5;
    const originLeft = 14.59375;
    const originTop = 56.359375;
    const plotResize = installPlotResize({ width, height });
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(originLeft, originTop, width, height));
    try {
      render(
        <StatsTimelineChart
          columns={[column(12, "CT"), column(13, "T")]}
          stat="adr"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={0}
          onSelect={() => undefined}
          onHover={() => undefined}
        />,
      );
      plotResize.resize({ width, height });
      const overlay = document.querySelector(".stats-timeline-axis-svg");
      const shiftX = pixelOriginShift(originLeft);
      const shiftY = pixelOriginShift(originTop);
      expect(originLeft + shiftX).toBe(Math.ceil(originLeft));
      expect(originTop + shiftY).toBe(Math.ceil(originTop));
      expect(overlay).toHaveStyle({ left: `${shiftX}px`, top: `${shiftY}px` });
      expect(overlay).toHaveAttribute("viewBox", `0 0 ${width - shiftX} ${height - shiftY}`);
      for (const line of document.querySelectorAll(
        ".stats-timeline-grid, .stats-timeline-break, .stats-timeline-hover",
      )) {
        expectPixelCenter(line);
      }
    } finally {
      spy.mockRestore();
      plotResize.restore();
    }
  });

  it("recomputes grid rules when the device pixel ratio changes", () => {
    const width = chartCssWidth(1920, SIDEBAR_DEFAULT_WIDTH);
    const height = 812.5;
    let ratio = 1;
    const queries: string[] = [];
    let listener: (() => void) | undefined;
    const previous = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      get: () => ratio,
    });
    vi.stubGlobal("matchMedia", (query: string) => {
      queries.push(query);
      return {
        matches: true,
        media: query,
        addEventListener: (_type: string, cb: () => void) => {
          listener = cb;
        },
        removeEventListener: () => undefined,
      };
    });
    const plotResize = installPlotResize({ width, height });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, width, height));
    try {
      render(
        <StatsTimelineChart
          columns={[column(12, "CT"), column(13, "T"), column(14, "T")]}
          stat="hs"
          colors={["#ffffff", "#000000"]}
          selected={null}
          hover={0}
          onSelect={() => undefined}
          onHover={() => undefined}
        />,
      );
      const before = document.querySelector(".stats-timeline-grid")?.getAttribute("x1");
      expect(before).toMatch(/\.5$/);
      expectSharedDeviceStroke(1);
      expect(document.querySelector(".stats-timeline-grid")).toHaveAttribute(
        "stroke-width",
        String(axisStrokeWidth(1)),
      );
      expect(queries.at(-1)).toBe("(resolution: 1dppx)");
      for (const next of [1.25, 1.5, 2]) {
        const previousX = document.querySelector(".stats-timeline-grid")?.getAttribute("x1");
        ratio = next;
        act(() => listener?.());
        const x = document.querySelector(".stats-timeline-grid")?.getAttribute("x1");
        expect(x).not.toBe(previousX);
        expectSharedDeviceStroke(next);
        expect(queries.at(-1)).toBe(`(resolution: ${next}dppx)`);
      }
    } finally {
      rectSpy.mockRestore();
      plotResize.restore();
      if (previous) Object.defineProperty(window, "devicePixelRatio", previous);
    }
  });
});
