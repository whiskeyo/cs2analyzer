import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeFreezeTicks,
  sampleMatchInfo,
} from "@/lib/testing/fixtures";
import { HITGROUP_CHEST, HITGROUP_HEAD } from "@/lib/shared/constants";
import type { Side } from "@/lib/replay/replayTypes";
import { Review } from "./Review";

function ReviewHarness({
  replay,
  tick,
  selected: initialSelected = null,
  reviewTeamSide: initialTeam = null,
  onJump = () => {},
}: {
  replay: ReturnType<typeof makeReplay>;
  tick: number;
  selected?: number | null;
  reviewTeamSide?: Side | null;
  onJump?: (tick: number) => void;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [reviewTeamSide, setReviewTeamSide] = useState(initialTeam);
  return (
    <Review
      replay={replay}
      tick={tick}
      selected={selected}
      reviewTeamSide={reviewTeamSide}
      onJump={onJump}
      onSelect={(index) => {
        setSelected(index);
        setReviewTeamSide(null);
      }}
      onSelectTeam={(side) => {
        setReviewTeamSide(side);
        setSelected(null);
      }}
    />
  );
}

describe("Review", () => {
  it("asks for a player or team when none is selected", () => {
    const replay = makeReplay({
      header: { team_ct: "MARTYRDOM", team_t: "Rooster" },
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(<ReviewHarness replay={replay} tick={640} />);
    expect(screen.getByText(/Select a player/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review team" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "MARTYRDOM" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Rooster" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Won the opening/)).not.toBeInTheDocument();
  });

  it("opens team review from the team filters with clickable round details", async () => {
    const onJump = vi.fn();
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = 1500;
    ticks.equip[1] = 4000;
    const replay = makeReplay({
      header: { team_ct: "Team Spirit", team_t: "G2" },
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 2, winner: "CT", start_tick: 64, freeze_end_tick: 128, end_tick: 800 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    render(<ReviewHarness replay={replay} tick={800} onJump={onJump} />);

    await userEvent.click(
      screen.getByRole("toolbar", { name: "Review team" }).querySelector("button")!,
    );
    expect(screen.getByRole("button", { name: "Team Spirit" })).toHaveClass("on");
    const summary = screen.getByText(/Won 1 eco\/force round/);
    expect(summary.closest("summary")).toHaveTextContent("Won 1 eco/force round · 1 round");
    const spoiler = summary.closest("details");
    expect(spoiler).not.toHaveAttribute("open");

    await userEvent.click(summary);
    expect(spoiler).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: /R2.*Won on an eco/ }));
    expect(onJump).toHaveBeenCalledWith(128);
  });

  it("shows player-specific review when selected and keeps team filters visible", () => {
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Won the opening/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review team" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Player" })).not.toBeInTheDocument();
  });

  it("switches to team review from a selected player via the team name", async () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = 1500;
    ticks.equip[1] = 4000;
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 2, winner: "CT", start_tick: 64, freeze_end_tick: 128, end_tick: 800 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    render(<ReviewHarness replay={replay} tick={800} selected={0} />);
    expect(screen.getByText(/Won the opening/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Astralis" }));
    expect(screen.getByRole("button", { name: "Astralis" })).toHaveClass("on");
    const summary = screen.getByText(/Won 1 eco\/force round/);
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByText(/Won the opening/)).not.toBeInTheDocument();
  });

  it("dims player spoiler events that have not happened yet", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 1)],
    });
    render(<ReviewHarness replay={replay} tick={80} selected={0} />);
    await userEvent.click(screen.getByText(/Won 1 opening/));
    const rows = screen.getAllByRole("button").filter((el) => el.className.includes("review-note"));
    expect(rows.some((row) => row.className.includes("pending"))).toBe(true);
  });

  it("jumps from a player spoiler event", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(300, 1, 0)],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} onJump={onJump} />);

    await userEvent.click(screen.getByText(/Won 1 opening/));
    await userEvent.click(screen.getByRole("button", { name: /R1.*Won the opening/ }));
    // Kill at 200 → 1.5s (96 ticks) lead-in.
    expect(onJump).toHaveBeenCalledWith(104);
  });

  it("keeps player event details closed until a headline is expanded", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 2,
          winner: "T",
          start_tick: 641,
          freeze_end_tick: 700,
          end_tick: 1400,
        }),
      ],
      kills: [makeKill(100, 0, 1), makeKill(800, 1, 0)],
    });
    render(<ReviewHarness replay={replay} tick={1400} selected={0} />);
    const summary = screen.getByText(/Won 1 opening/);
    const spoiler = summary.closest("details");
    expect(spoiler).not.toHaveAttribute("open");
    expect(screen.queryByRole("toolbar", { name: "Review sort" })).not.toBeInTheDocument();

    await userEvent.click(summary);
    expect(spoiler).toHaveAttribute("open");
    expect(screen.getAllByRole("button", { name: /R1.*Won the opening/ }).length).toBeGreaterThan(
      0,
    );
  });

  it("counts a repeated round once on a team spoiler and keeps every event", async () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Support"),
      makePlayer(2, "T", "Bob"),
      makePlayer(3, "T", "Cara"),
    ];
    const replay = makeReplay({
      header: { team_ct: "Rooster", team_t: "MARTYRDOM" },
      players,
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 5,
          winner: "CT",
          start_tick: 2000,
          freeze_end_tick: 2064,
          end_tick: 2600,
        }),
      ],
      kills: [
        makeKill(200, 0, 2, { assister: 1, assisted_flash: true }),
        makeKill(400, 0, 3, { assister: 1, assisted_flash: true }),
        makeKill(2200, 0, 2, { assister: 1, assisted_flash: true }),
      ],
    });
    render(<ReviewHarness replay={replay} tick={2600} reviewTeamSide="CT" />);

    const summary = screen.getByText(/3 flash assists/).closest("summary");
    expect(summary).toHaveTextContent("3 flash assists · 2 rounds");

    await userEvent.click(summary!);
    const rows = screen.getAllByRole("button", { name: /Flash assist by Support/ });
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, " "))).toEqual([
      expect.stringContaining("R1"),
      expect.stringContaining("R1"),
      expect.stringContaining("R5"),
    ]);
  });

  it("counts a repeated round once on a player spoiler and keeps every event", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 1, 0), makeKill(400, 1, 0)],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} />);

    const untraded = screen.getByText(/2 untraded deaths/).closest("summary");
    expect(untraded).toHaveTextContent("2 untraded deaths · 1 round");
    const gunfights = screen.getByText(/2 gunfights with almost no damage back/).closest("summary");
    expect(gunfights).toHaveTextContent("2 gunfights with almost no damage back · 1 round");

    await userEvent.click(untraded!);
    expect(
      within(untraded!.closest("details")!).getAllByRole("button", { name: /R1/ }),
    ).toHaveLength(2);
  });

  it("shows an empty hint when the selected player has no notes", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} />);
    expect(screen.getByText(/No player notes in this match/)).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Review sort" })).not.toBeInTheDocument();
  });

  it("shows headshot percent from enemy kills in the review header", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 1, { headshot: true }), makeKill(300, 0, 1)],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/50% HS \(1\/2\)/)).toBeInTheDocument();
  });

  it("includes killing-blow hitgroup on a death note", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 1, 0)],
      hurts: [
        makeHurt(120, 1, 0, 20, { hitgroup: HITGROUP_HEAD }),
        makeHurt(200, 1, 0, 34, { hitgroup: HITGROUP_CHEST }),
      ],
    });
    render(<ReviewHarness replay={replay} tick={640} selected={0} />);
    expect(screen.getByText(/Tagged in the head before 1 death/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Lost 1 opening/));
    expect(screen.getAllByText(/chest · tagged in head/).length).toBeGreaterThan(0);
  });

  it("keeps pistol badges on R1 and R13 and off overtime in a 22-20 match", async () => {
    const rounds = [
      { number: 1, winner: "CT" as const },
      { number: 13, winner: "T" as const },
      { number: 25, winner: "CT" as const },
      { number: 28, winner: "T" as const },
      { number: 31, winner: "CT" as const },
      { number: 34, winner: "T" as const },
      { number: 37, winner: "CT" as const },
      { number: 40, winner: "T" as const },
      { number: 42, winner: "CT" as const },
    ].map((spec, index) => {
      const start = index * 1000;
      return makeRound({
        number: spec.number,
        winner: spec.winner,
        start_tick: start,
        freeze_end_tick: start + 64,
        end_tick: start + 800,
      });
    });
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds,
      match_info: sampleMatchInfo(),
    });
    const end = rounds.reduce((max, round) => Math.max(max, round.end_tick), 0);
    render(<ReviewHarness replay={replay} tick={end} />);

    await userEvent.click(
      screen.getByRole("toolbar", { name: "Review team" }).querySelector("button")!,
    );
    expect(screen.getByRole("button", { name: "Astralis" })).toHaveClass("on");
    expect(screen.queryByText(/Lost \d+ pistol/)).not.toBeInTheDocument();
    const summary = screen.getByText(/Won 2 pistol rounds/);
    expect(summary.closest("summary")).toHaveTextContent("Won 2 pistol rounds · 2 rounds");

    await userEvent.click(summary);
    const spoiler = summary.closest("details");
    expect(spoiler).toHaveAttribute("open");
    const notes = within(spoiler!).getAllByRole("button", { name: /Won pistol/ });
    expect(notes.map((note) => note.querySelector(".review-round")?.textContent)).toEqual([
      "R1",
      "R13",
    ]);
    expect(within(spoiler!).queryByRole("button", { name: /R25/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R28/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R31/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R34/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R37/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R40/ })).not.toBeInTheDocument();
    expect(within(spoiler!).queryByRole("button", { name: /R42/ })).not.toBeInTheDocument();
  });

  it("shows a live clutch for the selected player", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      ticks: makeFreezeTicks(2, 1),
    });
    render(<ReviewHarness replay={replay} tick={100} selected={0} onJump={onJump} />);
    const live = screen.getByRole("button", { name: /Alice 1v1/ });
    expect(live.className).toContain("review-note");
    await userEvent.click(live);
    expect(onJump).toHaveBeenCalled();
  });
});
