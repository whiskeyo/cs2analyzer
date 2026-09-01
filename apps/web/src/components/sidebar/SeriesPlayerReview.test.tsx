import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { seriesPlayerReview } from "@/lib/parse/seriesPlayerReview";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { SeriesPlayerReview } from "./SeriesPlayerReview";

function reviewFixture() {
  const focal = "Team A";
  const a = loadedDemo(
    makeReplay({
      header: { team_ct: focal, team_t: "B" },
      players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    }),
    "a.dem",
    new File([], "a.dem"),
  );
  const series = buildSeries("de_mirage", [a]);
  const key = playerIdentityKey(a.replay, 0);
  return seriesPlayerReview(series, key, "Donk");
}

describe("SeriesPlayerReview", () => {
  it("shows the player name and demo count", () => {
    render(<SeriesPlayerReview review={reviewFixture()} onJump={() => {}} />);
    expect(screen.getByText(/Donk/)).toBeInTheDocument();
    expect(screen.getByText(/1 demos/)).toBeInTheDocument();
  });

  it("activates the good-only filter", async () => {
    render(<SeriesPlayerReview review={reviewFixture()} onJump={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Good" }));
    expect(screen.getByRole("button", { name: "Good" })).toHaveClass("on");
  });

  it("jumps when a note row is clicked", async () => {
    const onJump = vi.fn();
    render(<SeriesPlayerReview review={reviewFixture()} onJump={onJump} />);
    const note = screen.getAllByRole("button").find((b) => b.className.includes("review-note"));
    if (note) {
      await userEvent.click(note);
      expect(onJump).toHaveBeenCalledWith(
        expect.objectContaining({ demoId: expect.any(String), jumpTick: expect.any(Number) }),
      );
    }
  });
});
