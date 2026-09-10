import { describe, expect, it } from "vitest";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { applyRadarFollowCam, radarPaintInputs } from "./radarPaintDirty";
import { canvasInputsChanged } from "@/lib/shared/useCanvasLoop";
import { worldToRadar } from "./maps";
import { centerViewOnRadarPoint } from "./viewport";
import {
  makeFreezeTicks,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";

function dirtyArgs(overrides: Partial<Parameters<typeof radarPaintInputs>[0]> = {}) {
  const replay = makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    ticks: makeFreezeTicks(2, 1, 64),
  });
  return {
    tick: 100,
    view: { scale: 1, ox: 0, oy: 0 },
    layers: { ...DEFAULT_LAYERS },
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
    draft: null,
    playSec: undefined as number | undefined,
    follow: false,
    selected: null as number | null,
    trails: true,
    floorMode: "auto" as const,
    habitsOnly: false,
    habitsOverlay: null,
    habitsOverlayDisplay: undefined,
    habitsShowTrails: false,
    habitsShowArrows: true,
    habitsNadesOn: true,
    habitsNadeOpacity: 0.4,
    habitsNadeFilter: undefined,
    cal: UNIT_CALIBRATION,
    replay,
    viewEpoch: 0,
    imgUpper: null,
    imgLower: null,
    c4: null,
    nadeIcons: {},
    textMoveX: null,
    textMoveY: null,
    editing: false,
    skipText: null,
    editX: null,
    editY: null,
    ...overrides,
  };
}

describe("radarPaintInputs", () => {
  it("stays clean when tick, view, layers, strokes, and playSec are unchanged", () => {
    const last: { current: readonly unknown[] | null } = { current: null };
    const args = dirtyArgs();
    expect(canvasInputsChanged(last, radarPaintInputs(args))).toBe(true);
    expect(canvasInputsChanged(last, radarPaintInputs(args))).toBe(false);
  });

  it("dirties on tick, view pan, layer toggle, note identity, and habits playSec", () => {
    const last: { current: readonly unknown[] | null } = { current: null };
    const base = dirtyArgs();
    canvasInputsChanged(last, radarPaintInputs(base));

    expect(canvasInputsChanged(last, radarPaintInputs({ ...base, tick: 101 }))).toBe(true);
    expect(
      canvasInputsChanged(last, radarPaintInputs({ ...base, tick: 101, view: { ...base.view } })),
    ).toBe(false);

    expect(
      canvasInputsChanged(
        last,
        radarPaintInputs({ ...base, tick: 101, view: { scale: 1, ox: 8, oy: 0 } }),
      ),
    ).toBe(true);

    expect(
      canvasInputsChanged(
        last,
        radarPaintInputs({
          ...base,
          tick: 101,
          view: { scale: 1, ox: 8, oy: 0 },
          layers: { ...DEFAULT_LAYERS, names: false },
        }),
      ),
    ).toBe(true);

    const note = { groups: [], drawings: [], pieces: [], bookmarks: [] };
    expect(
      canvasInputsChanged(
        last,
        radarPaintInputs({
          ...base,
          tick: 101,
          view: { scale: 1, ox: 8, oy: 0 },
          layers: { ...DEFAULT_LAYERS, names: false },
          note,
        }),
      ),
    ).toBe(true);

    expect(
      canvasInputsChanged(
        last,
        radarPaintInputs({
          ...base,
          tick: 101,
          view: { scale: 1, ox: 8, oy: 0 },
          layers: { ...DEFAULT_LAYERS, names: false },
          note,
          playSec: 1.25,
        }),
      ),
    ).toBe(true);
  });
});

describe("applyRadarFollowCam", () => {
  it("pans so the followed pawn sits at the canvas centre", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks: makeFreezeTicks(1, 1, 64),
    });
    const view = { scale: 1, ox: 0, oy: 0 };
    applyRadarFollowCam(view, 400, 400, replay, 64, 0, true, UNIT_CALIBRATION);
    const radar = worldToRadar(UNIT_CALIBRATION, 0, 0);
    const expected = { scale: 1, ox: 0, oy: 0 };
    centerViewOnRadarPoint(expected, 400, 400, radar.x, radar.y);
    expect(view).toEqual(expected);
  });

  it("leaves the view alone when follow is off", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks: makeFreezeTicks(1, 1, 64),
    });
    const view = { scale: 1, ox: 4, oy: 8 };
    applyRadarFollowCam(view, 400, 400, replay, 64, 0, false, UNIT_CALIBRATION);
    expect(view).toEqual({ scale: 1, ox: 4, oy: 8 });
  });
});
