/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playerMarkColors } from "@/lib/players/playerColors";
import { makeKill, makePlayer, makeReplay, makeRound, makeHurt } from "@/lib/testing/fixtures";
import { AXIS_LABEL_PX, plotRect, roundX } from "@/lib/stats/timelineChart";
import type { TimelineColumn, TimelinePlayerRow, TimelineStatId } from "@/lib/stats/timeline";
import { StatsTimeline } from "./StatsTimeline";
import { StatsTimelineChart } from "./StatsTimelineChart";

function chartReplay() {
  return makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
    rounds: [
      makeRound({
        number: 0,
        is_knife: true,
        start_tick: 0,
        end_tick: 80,
        winner: "T",
        score_ct: 0,
        score_t: 0,
      }),
      makeRound({
        number: 1,
        start_tick: 100,
        end_tick: 400,
        winner: "CT",
        score_ct: 0,
        score_t: 0,
      }),
      makeRound({
        number: 2,
        start_tick: 500,
        end_tick: 700,
        winner: "T",
        score_ct: 1,
        score_t: 0,
      }),
      makeRound({
        number: 3,
        start_tick: 800,
        end_tick: 1100,
        winner: "CT",
        score_ct: 1,
        score_t: 0,
      }),
    ],
    kills: [makeKill(40, 1, 0), makeKill(200, 0, 1), makeKill(600, 1, 0), makeKill(900, 0, 1)],
    hurts: [makeHurt(190, 0, 1, 80)],
  });
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

describe("StatsTimeline", () => {
  it("charts counted rounds and leaves knife and restarts off the axis", () => {
    render(<StatsTimeline replay={chartReplay()} />);
    expect(screen.getByRole("heading", { name: "Stats timeline" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "ADR cumulative" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "K/D" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Per round" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Round 1" })).toHaveTextContent("R1");
    expect(screen.getByRole("img", { name: "Round 3" })).toHaveTextContent("R3");
    expect(screen.queryByRole("img", { name: "Round 0" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Round 2" })).not.toBeInTheDocument();
    expect(document.querySelector(".stats-timeline-round")).toBeNull();
    expect(document.querySelector(".stats-timeline-win-icon")).toBeNull();
    expect(screen.queryByRole("button", { name: "Alice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight Alice" })).toBeInTheDocument();
  });

  it("shows a round card above the chart and highlights the clicked player", async () => {
    const user = userEvent.setup();
    render(<StatsTimeline replay={chartReplay()} />);
    fireEvent.pointerEnter(screen.getByRole("img", { name: /^Round 1/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Round 1");
    expect(screen.getByRole("status")).not.toHaveTextContent("Won");
    expect(screen.getByRole("status")).not.toHaveTextContent("Lost");
    expect(screen.queryByText("CT")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("80");
    expect(screen.getByRole("status")).toHaveTextContent("Alice");

    await user.click(screen.getByRole("button", { name: "Highlight Alice" }));
    expect(document.querySelector(".stats-timeline-line.is-on")).toHaveAttribute(
      "stroke",
      playerMarkColors(chartReplay().players)[0],
    );
    expect(document.querySelector(".stats-timeline-line.is-on")).toHaveAttribute(
      "stroke-width",
      "1.6",
    );
    expect(document.querySelector(".stats-timeline-line.is-on")).toHaveAttribute(
      "vector-effect",
      "non-scaling-stroke",
    );
    expect(document.querySelector(".stats-timeline-line.is-dim")).toHaveAttribute(
      "stroke-width",
      "0.9",
    );
    expect(document.querySelector("feGaussianBlur")).toBeNull();
    expect(document.querySelector(".stats-timeline-line")).not.toHaveAttribute("filter");
    expect(document.querySelector(".stats-timeline-area")).toBeNull();
    expect(document.querySelector(".stats-timeline-plot rect")).toBeNull();
    expect(document.querySelectorAll(".stats-timeline-line.is-dim").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Highlight Alice" }));
    expect(document.querySelectorAll(".stats-timeline-line.is-dim")).toHaveLength(0);
  });

  it("switches the plotted stat on the cumulative chart", async () => {
    const user = userEvent.setup();
    render(<StatsTimeline replay={chartReplay()} />);
    await user.click(screen.getByRole("button", { name: "Kills" }));
    expect(screen.getByRole("group", { name: "Kills cumulative" })).toBeInTheDocument();
  });

  it("draws a thin separator on a side swap without moving it", () => {
    const columns = [swappedColumn(12, "CT"), swappedColumn(13, "T")];
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
    expect(document.querySelector(".stats-timeline-plot svg")).toHaveAttribute(
      "preserveAspectRatio",
      "none",
    );
    const line = document.querySelector(".stats-timeline-break");
    expect(line).toHaveAttribute("stroke-width", "1");
    expect(line).toHaveAttribute("stroke-opacity", "0.5");
    expect(line).toHaveAttribute("vector-effect", "non-scaling-stroke");
    const plot = plotRect();
    const mid = (roundX(0, columns.length, plot) + roundX(1, columns.length, plot)) / 2;
    expect(line).toHaveAttribute("x1", String(mid));
    expect(line).toHaveAttribute("x2", String(mid));
  });

  it("keeps every round label at a fixed size, upright only when horizontal type would overlap", () => {
    const columns = Array.from({ length: 40 }, (_, index) => swappedColumn(index + 1, "CT"));
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const chart = (
      <StatsTimelineChart
        columns={columns}
        stat="adr"
        colors={["#ffffff"]}
        selected={null}
        hover={null}
        onSelect={() => undefined}
        onHover={() => undefined}
      />
    );

    spy.mockReturnValue(new DOMRect(0, 0, 1400, 220));
    const wide = render(chart);
    const wideLabels = screen.getAllByRole("img", { name: /^Round / });
    expect(wideLabels).toHaveLength(columns.length);
    expect(wideLabels.map((label) => label.textContent)).toEqual(
      columns.map((column) => `R${column.number}`),
    );
    expect(wideLabels[0]).toHaveStyle({ fontSize: `${AXIS_LABEL_PX}px` });
    expect(wideLabels[0]).not.toHaveClass("is-vertical");
    expect(wideLabels[0]?.closest("svg")).toBeNull();
    wide.unmount();

    spy.mockReturnValue(new DOMRect(0, 0, 160, 220));
    render(chart);
    const narrowLabels = screen.getAllByRole("img", { name: /^Round / });
    expect(narrowLabels).toHaveLength(columns.length);
    expect(narrowLabels.map((label) => label.textContent)).toEqual(
      columns.map((column) => `R${column.number}`),
    );
    expect(narrowLabels[0]).toHaveClass("is-vertical");
    expect(narrowLabels[0]).toHaveStyle({ fontSize: `${AXIS_LABEL_PX}px` });
    const axis = document.querySelector(".stats-timeline-axis");
    expect(axis).toHaveStyle({ fontSize: `${AXIS_LABEL_PX}px` });
    expect(axis?.closest("svg")).toBeNull();
    vi.restoreAllMocks();
  });

  it("says when every round was a knife round", () => {
    render(
      <StatsTimeline
        replay={makeReplay({
          rounds: [makeRound({ number: 0, is_knife: true, winner: "T" })],
        })}
      />,
    );
    expect(screen.getByText("No competitive rounds to chart.")).toBeInTheDocument();
  });
});
