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
