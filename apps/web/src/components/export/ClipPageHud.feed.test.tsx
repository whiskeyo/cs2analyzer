import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KillFeed } from "@/components/radar/KillFeed";
import { CLIP_EXPORT_SIZE_DEFAULT, clipExportFrame } from "@/lib/export/constants";
import { CLIP_HUD_PANEL_FEED } from "@/lib/export/clipPageHudKey";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { ClipPageHud } from "./ClipPageHud";

const tps = DEFAULT_TICK_RATE;

function victimNames(root: ParentNode): string[] {
  return [...root.querySelectorAll(".kill-feed .vic")].map((node) => node.textContent ?? "");
}

describe("clip kill feed", () => {
  it("matches the page KillFeed, newest on top, on the node the clip rasters", () => {
    const names = ["Nova", "Mia", "Leo", "Kai", "Eve"];
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Ace"),
        ...names.map((name, i) => makePlayer(i + 1, "T", name)),
      ],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 8000 })],
      kills: names.map((_, i) => makeKill(1000 + i * tps, 0, i + 1)),
    });
    const tick = 1000 + (names.length - 1) * tps;
    const frame = clipExportFrame(CLIP_EXPORT_SIZE_DEFAULT);
    const page = render(<KillFeed replay={replay} tick={tick} onJump={() => undefined} />);
    const clip = render(
      <ClipPageHud
        replay={replay}
        tick={tick}
        selected={null}
        width={frame.width}
        height={frame.height}
      />,
    );
    const feed = clip.container.querySelector(
      `[data-clip-panel="${CLIP_HUD_PANEL_FEED}"] .kill-feed`,
    );
    expect(feed).not.toBeNull();
    const pageOrder = victimNames(page.container);
    const clipOrder = victimNames(feed as ParentNode);
    expect(pageOrder.length).toBeGreaterThanOrEqual(5);
    expect(clipOrder).toEqual(pageOrder);
    expect(clipOrder[0]).toBe("Eve");
    expect(clipOrder[clipOrder.length - 1]).toBe("Nova");
  });

  it("rasters a world death as the victim and a skull, with no attacker name", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 8000 })],
      kills: [makeKill(1000, -1, 0, { weapon: "world" })],
    });
    const frame = clipExportFrame(CLIP_EXPORT_SIZE_DEFAULT);
    const clip = render(
      <ClipPageHud
        replay={replay}
        tick={1000}
        selected={null}
        width={frame.width}
        height={frame.height}
      />,
    );
    const feed = clip.container.querySelector(
      `[data-clip-panel="${CLIP_HUD_PANEL_FEED}"] .kill-feed`,
    );
    expect(feed).not.toBeNull();
    expect(feed?.textContent).not.toContain("World");
    expect(feed?.querySelector(".att")).toBeNull();
    expect(feed?.querySelector(".vic")?.textContent).toBe("Alice");
    expect(feed?.querySelector("img")?.getAttribute("src")).toContain("skull.svg");
  });
});
