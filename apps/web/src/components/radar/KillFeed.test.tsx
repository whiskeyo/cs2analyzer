import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TICK_RATE, KILL_FEED_SECONDS } from "@/lib/shared/constants";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { KillFeed } from "./KillFeed";

const tps = DEFAULT_TICK_RATE;

function replayWithKills() {
  return makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob"), makePlayer(2, "T", "Dave")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
    kills: [makeKill(1000, 0, 1), makeKill(2000, 0, 2)],
  });
}

describe("KillFeed", () => {
  it("shows only kills inside the feed window", () => {
    const replay = replayWithKills();
    render(<KillFeed replay={replay} tick={2000} onJump={() => {}} />);

    expect(screen.getByText("Dave")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toHaveClass("att", "ct");
    expect(screen.getByText("Dave")).toHaveClass("vic", "t");
    // The 1000-tick frag is more than KILL_FEED_SECONDS old by now.
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("renders nothing when no kill is recent", () => {
    const replay = replayWithKills();
    const { container } = render(
      <KillFeed replay={replay} tick={2000 + (KILL_FEED_SECONDS + 1) * tps} onJump={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("jumps to the kill tick when a row is clicked", async () => {
    const onJump = vi.fn();
    render(<KillFeed replay={replayWithKills()} tick={2000} onJump={onJump} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onJump).toHaveBeenCalledWith(2000);
  });

  it("shows each kill modifier icon", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      kills: [
        makeKill(1000, 0, 1, {
          noscope: true,
          through_smoke: true,
          wallbang: true,
          attacker_airborne: true,
          attacker_blind: true,
          headshot: true,
        }),
      ],
    });
    render(<KillFeed replay={replay} tick={1000} onJump={() => {}} />);
    expect(screen.getByTitle("No-scope")).toHaveAttribute(
      "src",
      expect.stringContaining("noscope.svg"),
    );
    expect(screen.getByTitle("Through smoke")).toHaveAttribute(
      "src",
      expect.stringContaining("through_smoke.svg"),
    );
    expect(screen.getByTitle("Wallbang")).toHaveAttribute(
      "src",
      expect.stringContaining("wallbang.svg"),
    );
    expect(screen.getByTitle("Airborne")).toHaveAttribute(
      "src",
      expect.stringContaining("attacker_airborne.svg"),
    );
    expect(screen.getByTitle("Blind")).toHaveAttribute(
      "src",
      expect.stringContaining("attacker_blind.svg"),
    );
    expect(screen.getByTitle("Headshot")).toBeInTheDocument();
  });

  it("hides modifier icons when the flags are off", () => {
    render(<KillFeed replay={replayWithKills()} tick={2000} onJump={() => {}} />);
    expect(screen.queryByTitle("No-scope")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Through smoke")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Wallbang")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Airborne")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Blind")).not.toBeInTheDocument();
  });

  it("names a mapped bot instead of World", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Mike", 0xb0700005, true)],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      kills: [makeKill(1000, 1, 0)],
    });
    render(<KillFeed replay={replay} tick={1000} onJump={() => {}} />);
    expect(screen.getByText("Mike (BOT)")).toHaveClass("att", "t");
    expect(screen.queryByText("World")).not.toBeInTheDocument();
  });

  it("names the world as the attacker when there is no killer", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      kills: [makeKill(1000, -1, 0, { weapon: "world" })],
    });
    render(<KillFeed replay={replay} tick={1000} onJump={() => {}} />);
    expect(screen.getByText("World")).toHaveClass("att");
    expect(screen.getByText("World")).not.toHaveClass("ct", "t");
    expect(screen.getByText("Alice")).toHaveClass("vic", "ct");
  });
});
