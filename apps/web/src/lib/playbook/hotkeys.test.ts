import { describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { cyclePaletteId, colorAtSwatch, PLAYBOOK_TOOL_KEYS } from "./hotkeys";

describe("playbook hotkeys", () => {
  it("maps draw and token keys", () => {
    expect(PLAYBOOK_TOOL_KEYS.v).toBe("pan");
    expect(PLAYBOOK_TOOL_KEYS.d).toBe("pen");
    expect(PLAYBOOK_TOOL_KEYS.q).toBe("pawn-ct");
    expect(PLAYBOOK_TOOL_KEYS.s).toBe("smoke");
  });

  it("cycles palettes and reads swatches", () => {
    expect(cyclePaletteId("neon", 1)).toBe("heat");
    expect(cyclePaletteId("mark", 1)).toBe("neon");
    expect(cyclePaletteId("unknown", -1)).toBe(COLOR_PRESETS[COLOR_PRESETS.length - 1]!.id);
    expect(colorAtSwatch("neon", 0)).toBe(COLOR_PRESETS[0]!.colors[0]);
    expect(colorAtSwatch("neon", 9)).toBeNull();
  });
});
