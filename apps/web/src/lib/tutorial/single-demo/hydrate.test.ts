import { describe, expect, it } from "vitest";
import { TUTORIAL_FILENAME, TUTORIAL_ID } from "./constants";
import { hydrateTutorialReplay, tutorialFileStub } from "./hydrate";
import { loadTutorialReplay } from "../load";

describe("tutorial fixture", () => {
  it("uses a stable id and a name-only File stub", () => {
    expect(TUTORIAL_FILENAME).toBe("tutorial.dem");
    expect(TUTORIAL_ID).toMatch(/^tutorial\|.+/);
    const file = tutorialFileStub();
    expect(file.name).toBe(TUTORIAL_FILENAME);
    expect(file.size).toBe(0);
  });

  it("hydrates a Replay that passes decode checks and SoA lengths", () => {
    const replay = hydrateTutorialReplay();
    expect(replay.header.map_name.length).toBeGreaterThan(0);
    const { ticks } = replay;
    const n = ticks.frameCount * ticks.playerCount;
    expect(ticks.ticks).toBeInstanceOf(Uint32Array);
    expect(ticks.x).toBeInstanceOf(Float32Array);
    expect(ticks.ticks.length).toBe(ticks.frameCount);
    expect(ticks.x.length).toBe(n);
    expect(ticks.y.length).toBe(n);
    expect(ticks.z.length).toBe(n);
    expect(ticks.yaw.length).toBe(n);
    expect(ticks.health.length).toBe(n);
    expect(ticks.armor.length).toBe(n);
    expect(ticks.flags.length).toBe(n);
    expect(ticks.money.length).toBe(n);
    expect(ticks.equip.length).toBe(n);
    expect(ticks.gear.length).toBe(n);
    expect(ticks.primary.length).toBe(n);
    expect(ticks.secondary.length).toBe(n);
    expect(ticks.active.length).toBe(n);
    expect(ticks.clip.length).toBe(n);
    expect(ticks.reserve.length).toBe(n);
  });

  it("lazy-loads through loadTutorialReplay", async () => {
    const replay = await loadTutorialReplay();
    expect(replay.header.map_name.length).toBeGreaterThan(0);
  });
});
