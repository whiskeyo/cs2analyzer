import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { ratingBandClass, ratingRangeFor } from "@/lib/stats/rating";
import { computeStats } from "@/lib/stats/stats";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { Scoreboard } from "./Scoreboard";

/** Two CTs and two Ts, all alive at freeze, with one CT frag on the board. */
function replay() {
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
    ticks: makeFreezeTicks(4, 2),
    kills: [makeKill(200, 0, 2)],
  });
}

function teamTable(name: string): HTMLElement {
  const head = screen.getByText(name);
  const team = head.closest(".sb-team");
  if (!team) throw new Error(`no team block for ${name}`);
  return team as HTMLElement;
}

describe("Scoreboard", () => {
  it("groups players under the side they are on at this tick", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={null} onSelect={() => {}} />);

    const ct = teamTable("Astralis");
    expect(within(ct).getByText("Alice")).toBeInTheDocument();
    expect(within(ct).getByText("Bob")).toBeInTheDocument();
    expect(within(ct).queryByText("Cara")).not.toBeInTheDocument();

    const t = teamTable("Vitality");
    expect(within(t).getByText("Cara")).toBeInTheDocument();
    expect(within(t).getByText("Dan")).toBeInTheDocument();
  });

  it("reports the kill and the entry frag for the opener", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={0} onSelect={() => {}} />);

    const detail = screen.getByRole("heading", { name: "Alice" }).closest(".detail");
    expect(detail).not.toBeNull();
    expect(within(detail as HTMLElement).getByText("1 / 0 / 0 (1.00)")).toBeInTheDocument();
    // Alice won the only opening duel of the round.
    expect(within(detail as HTMLElement).getByText(/1 \/ 0 · 100% entry/)).toBeInTheDocument();
    expect(
      within(detail as HTMLElement).getByText("Firepower / Impact / Support / Clutch"),
    ).toBeInTheDocument();
    expect(
      within(detail as HTMLElement).getByText("1v1 / 1v2 / 1v3 / 1v4 / 1v5 (W/A)"),
    ).toBeInTheDocument();
  });

  it("selects a player when their row is clicked", async () => {
    const onSelect = vi.fn();
    render(<Scoreboard replay={replay()} tick={640} selected={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Cara"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("shows a $0 Operator bot on the live scoreboard", () => {
    const ticks = makeTicks(1, 1);
    ticks.ticks[0] = 64;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.health[0] = FULL_HEALTH;
    const m = makeReplay({
      header: { team_ct: "AdaskoBlyat", team_t: "Bricaa" },
      players: [makePlayer(0, "T", "Operator", 0xb0700007, true)],
      rounds: [makeRound({ number: 12, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    render(<Scoreboard replay={m} tick={64} selected={null} onSelect={() => {}} />);
    expect(within(teamTable("Bricaa")).getByText("Operator (BOT)")).toBeInTheDocument();
  });

  it("labels a live bot and does not keep the disconnected human", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 640;
    ticks.flags[0] = 0;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.health.fill(FULL_HEALTH);
    ticks.money[1] = 800;
    const m = makeReplay({
      header: { team_ct: "AdaskoBlyat", team_t: "Bricaa" },
      players: [
        makePlayer(0, "CT", "KatolikCOO"),
        makePlayer(1, "CT", "KatolikCOO", 0xb0700005, true),
      ],
      rounds: [makeRound({ number: 13, winner: "CT", start_tick: 0, end_tick: 640 })],
      ticks,
    });
    render(<Scoreboard replay={m} tick={640} selected={1} onSelect={() => {}} />);
    expect(within(teamTable("AdaskoBlyat")).getByText("KatolikCOO (BOT)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "KatolikCOO (BOT)" })).toBeInTheDocument();
    expect(screen.getByText("Bot")).toBeInTheDocument();
    expect(within(teamTable("AdaskoBlyat")).queryByText(/^KatolikCOO$/)).not.toBeInTheDocument();
  });

  it("hides a disconnected player so a leave does not add a ghost row after swap", () => {
    const ticks = makeTicks(3, 1);
    ticks.ticks[0] = 640;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[2] = 0;
    ticks.health.fill(FULL_HEALTH);
    const m = makeReplay({
      header: { team_ct: "Bricaa", team_t: "AdaskoBlyat" },
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Bob"),
        makePlayer(2, "T", "KatolikCOO"),
      ],
      rounds: [makeRound({ number: 13, winner: "T", start_tick: 0, end_tick: 640 })],
      ticks,
    });
    render(<Scoreboard replay={m} tick={640} selected={null} onSelect={() => {}} />);

    expect(within(teamTable("Bricaa")).getByText("Alice")).toBeInTheDocument();
    expect(within(teamTable("AdaskoBlyat")).getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("KatolikCOO")).not.toBeInTheDocument();
  });

  it("does not show a sixth $0 leftover on a 5-stack side", () => {
    const ticks = makeTicks(6, 2);
    ticks.ticks.set([64, 640]);
    for (let i = 0; i < 5; i++) {
      ticks.flags[i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.flags[6 + i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    }
    ticks.flags[5] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[11] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.health.fill(FULL_HEALTH);
    ticks.money[6] = 800;
    ticks.money[7] = 800;
    ticks.money[8] = 800;
    ticks.money[9] = 800;
    ticks.money[10] = 800;
    const m = makeReplay({
      header: { team_ct: "AdaskoBlyat", team_t: "Bricaa" },
      players: [
        makePlayer(0, "CT", "Adasko"),
        makePlayer(1, "CT", "arko2211"),
        makePlayer(2, "CT", "yazuyy"),
        makePlayer(3, "CT", "Olivvkaxx"),
        makePlayer(4, "CT", "Mattiii208"),
        makePlayer(5, "CT", "KatolikCOO"),
      ],
      rounds: [makeRound({ number: 13, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    render(<Scoreboard replay={m} tick={640} selected={null} onSelect={() => {}} />);
    expect(
      screen.queryByText("KatolikCOO"),
      "ghost $0 leaver must not appear on live scoreboard",
    ).not.toBeInTheDocument();
    expect(within(teamTable("AdaskoBlyat")).getByText("Mattiii208")).toBeInTheDocument();
    expect(within(teamTable("AdaskoBlyat")).getByText("Adasko")).toBeInTheDocument();
  });

  it("hides a leftover controller still flagged present after they left", () => {
    const ticks = makeTicks(3, 2);
    ticks.ticks.set([64, 640]);
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[2] = FLAG_PRESENT;
    ticks.flags[3] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[4] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[5] = FLAG_PRESENT;
    ticks.health.fill(FULL_HEALTH);
    ticks.health[2] = 0;
    ticks.health[5] = 0;
    const m = makeReplay({
      header: { team_ct: "Bricaa", team_t: "AdaskoBlyat" },
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Bob"),
        makePlayer(2, "T", "KatolikCOO"),
      ],
      rounds: [
        makeRound({ number: 13, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      ticks,
    });
    render(<Scoreboard replay={m} tick={640} selected={null} onSelect={() => {}} />);

    expect(within(teamTable("Bricaa")).getByText("Alice")).toBeInTheDocument();
    expect(within(teamTable("AdaskoBlyat")).getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("KatolikCOO")).not.toBeInTheDocument();
  });

  it("marks the selected row so the radar and table stay in sync", () => {
    render(<Scoreboard replay={replay()} tick={640} selected={1} onSelect={() => {}} />);

    // "Bob" also appears as the detail heading, so look inside the CT table.
    const ct = teamTable("Astralis");
    expect(within(ct).getByText("Bob").closest("tr")).toHaveClass("selected");
    expect(within(ct).getByText("Alice").closest("tr")).not.toHaveClass("selected");
  });

  it("colors each rating with the matching range band", () => {
    const match = replay();
    render(<Scoreboard replay={match} tick={640} selected={0} onSelect={() => {}} />);
    const alice = computeStats(match, 640).find((s) => s.player === 0);
    if (!alice) throw new Error("missing Alice stats");
    const band = ratingBandClass(alice.rating);
    const label = ratingRangeFor(alice.rating).label;
    const formatted = alice.rating.toFixed(2);

    const row = within(teamTable("Astralis")).getByText("Alice").closest("tr");
    if (!row) throw new Error("missing Alice row");
    const rowMark = within(row).getByTitle(label);
    expect(rowMark).toHaveClass(band);
    expect(rowMark).toHaveTextContent(formatted);

    const detail = screen.getByRole("heading", { name: "Alice" }).closest(".detail");
    if (!detail) throw new Error("missing Alice detail");
    const detailMark = within(detail as HTMLElement).getByTitle(label);
    expect(detailMark).toHaveClass(band);
    expect(detailMark).toHaveTextContent(formatted);
  });
});
