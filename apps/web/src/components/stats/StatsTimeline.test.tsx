/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { COOL_TEAM, playerMarkColors } from "@/lib/players/playerColors";
import { makeKill, makePlayer, makeReplay, makeRound, makeHurt } from "@/lib/testing/fixtures";
import { StatsTimeline } from "./StatsTimeline";

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

describe("StatsTimeline", () => {
  it("charts counted rounds and leaves knife and restarts off the axis", () => {
    render(<StatsTimeline replay={chartReplay()} />);
    expect(screen.getByRole("heading", { name: "Stats timeline" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "ADR cumulative" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "K/D" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Per round" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Round 1, CT elim" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Round 3/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Round 0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Round 2/ })).not.toBeInTheDocument();
    expect(document.querySelector(".stats-timeline-round")).toHaveAttribute("fill", COOL_TEAM);
    expect(document.querySelector(".stats-timeline-win-icon")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight Alice" })).toBeInTheDocument();
  });

  it("shows a round card above the chart and highlights the clicked player", async () => {
    const user = userEvent.setup();
    render(<StatsTimeline replay={chartReplay()} />);
    fireEvent.pointerEnter(screen.getByRole("img", { name: /^Round 1/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Round 1");
    expect(screen.getByRole("status")).toHaveTextContent("Won");
    expect(screen.getByRole("status")).toHaveTextContent("80");
    expect(screen.getByRole("status")).toHaveTextContent("Alice");

    await user.click(screen.getByRole("button", { name: "Highlight Alice" }));
    expect(document.querySelector(".stats-timeline-line.is-on")).toHaveAttribute(
      "stroke",
      playerMarkColors(chartReplay().players)[0],
    );
    expect(document.querySelector(".stats-timeline-area")).toBeTruthy();
    expect(document.querySelectorAll(".stats-timeline-line.is-dim").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Highlight Alice" }));
    expect(document.querySelector(".stats-timeline-area")).toBeNull();
  });

  it("switches the plotted stat on the cumulative chart", async () => {
    const user = userEvent.setup();
    render(<StatsTimeline replay={chartReplay()} />);
    await user.click(screen.getByRole("button", { name: "Kills" }));
    expect(screen.getByRole("group", { name: "Kills cumulative" })).toBeInTheDocument();
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
