import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeFreezeTicks,
} from "@/lib/testing/fixtures";
import { HITGROUP_CHEST, HITGROUP_HEAD } from "@/lib/shared/constants";
import { Review } from "./Review";

function playerNoteButtons() {
  return screen
    .getAllByRole("button")
    .filter((el) => el.className.includes("review-note") && !el.className.includes("opening-duel"));
}

describe("Review", () => {
  it("asks for a player when none is selected", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={null} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Select a player/)).toBeInTheDocument();
    expect(screen.queryByText(/Won the opening/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alice killed Bob/ })).toBeInTheDocument();
  });

  it("hides opening duels when the list is turned off", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review
        replay={replay}
        tick={640}
        selected={null}
        onJump={() => {}}
        onSelect={() => {}}
        showOpenings={false}
      />,
    );
    expect(screen.queryByRole("region", { name: "Opening duels" })).not.toBeInTheDocument();
  });

  it("shows player-specific review when selected", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/Won the opening/)).toBeInTheDocument();
  });

  it("dims notes that have not happened yet", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1)],
    });
    render(<Review replay={replay} tick={80} selected={0} onJump={() => {}} onSelect={() => {}} />);
    const rows = playerNoteButtons();
    expect(rows.some((row) => row.className.includes("pending"))).toBe(true);
  });

  it("jumps from a player note", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(300, 1, 0)],
    });
    render(<Review replay={replay} tick={640} selected={0} onJump={onJump} onSelect={() => {}} />);

    const note = playerNoteButtons()[0];
    expect(note).toBeDefined();
    await userEvent.click(note!);
    expect(onJump).toHaveBeenCalled();
  });

  it("toggles the note list between round order and severity order", async () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
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
    render(
      <Review replay={replay} tick={1400} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    const titles = () => playerNoteButtons().map((el) => el.textContent ?? "");

    expect(screen.getByRole("toolbar", { name: "Review sort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Round" })).toHaveClass("on");
    expect(titles()[0]).toMatch(/Won the opening/);
    expect(titles()[titles().length - 1]).toMatch(/Lost the opening|Died to/);

    await userEvent.click(screen.getByRole("button", { name: "Severity" }));
    expect(screen.getByRole("button", { name: "Severity" })).toHaveClass("on");
    expect(titles()[0]).toMatch(/Lost the opening|Died to/);
    expect(titles()[titles().length - 1]).toMatch(/Won the opening/);
  });

  it("shows an empty hint when the selected player has no notes", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/No player notes in this match/)).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Review sort" })).not.toBeInTheDocument();
  });

  it("shows headshot percent from enemy kills in the review header", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 0, 1, { headshot: true }), makeKill(300, 0, 1)],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/50% HS \(1\/2\)/)).toBeInTheDocument();
  });

  it("includes killing-blow hitgroup on a death note", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      kills: [makeKill(200, 1, 0)],
      hurts: [
        makeHurt(120, 1, 0, 20, { hitgroup: HITGROUP_HEAD }),
        makeHurt(200, 1, 0, 34, { hitgroup: HITGROUP_CHEST }),
      ],
    });
    render(
      <Review replay={replay} tick={640} selected={0} onJump={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/chest · tagged in head/)).toBeInTheDocument();
    expect(screen.getByText(/Tagged in the head before 1 death/)).toBeInTheDocument();
  });

  it("shows a live clutch for the selected player", async () => {
    const onJump = vi.fn();
    const onSelect = vi.fn();
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
      ticks: makeFreezeTicks(2, 1),
    });
    render(<Review replay={replay} tick={100} selected={0} onJump={onJump} onSelect={onSelect} />);
    const live = screen.getByRole("button", { name: /Alice 1v1/ });
    expect(live.className).toContain("review-note");
    await userEvent.click(live);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onJump).toHaveBeenCalled();
  });
});
