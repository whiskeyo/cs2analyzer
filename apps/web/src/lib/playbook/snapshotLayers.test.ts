import { describe, expect, it } from "vitest";
import type { Drawing, DrawingGroup, NoteRadarFx, Piece } from "@/lib/notes/types";
import { makePiece } from "./pieces";
import {
  applySnapshotLayers,
  DEFAULT_SNAPSHOT_LAYERS,
  filterSnapshotPieces,
  snapshotLayerSelected,
} from "./snapshotLayers";

function fx(partial: Partial<NoteRadarFx> = {}): NoteRadarFx {
  return {
    deaths: [],
    opening: null,
    tracers: [],
    trails: [],
    heatmap: [],
    summary: [],
    cone: null,
    hits: [],
    flashes: [],
    ...partial,
  };
}

describe("snapshotLayerSelected", () => {
  it("is true for the default full stamp and false when every layer is off", () => {
    expect(snapshotLayerSelected(DEFAULT_SNAPSHOT_LAYERS)).toBe(true);
    expect(
      snapshotLayerSelected({
        pawns: false,
        util: false,
        kills: false,
        drawings: false,
      }),
    ).toBe(false);
  });
});

describe("filterSnapshotPieces", () => {
  it("keeps pawns, util, and leftover kinds by the matching toggle", () => {
    const pawn = makePiece("pawn", 1, 2, { label: "Alice" });
    const smoke = makePiece("smoke", 3, 4);
    const bomb = makePiece("bomb", 5, 6);
    expect(
      filterSnapshotPieces([pawn, smoke, bomb], {
        ...DEFAULT_SNAPSHOT_LAYERS,
        pawns: false,
      }).map((piece) => piece.kind),
    ).toEqual(["smoke", "bomb"]);
    expect(
      filterSnapshotPieces([pawn, smoke, bomb], {
        ...DEFAULT_SNAPSHOT_LAYERS,
        util: false,
      }).map((piece) => piece.kind),
    ).toEqual(["pawn"]);
  });
});

describe("applySnapshotLayers", () => {
  const pawn = makePiece("pawn", 1, 2, { groupId: "g1", label: "donk" });
  const flash = makePiece("flash", 3, 4);
  const drawing: Drawing = {
    type: "pen",
    color: "#fff",
    points: [{ x: 0, y: 0 }],
  };
  const pawnGroup: DrawingGroup = { id: "g1", name: "donk", drawings: [] };
  const inkGroup: DrawingGroup = {
    id: "ink",
    name: "A take",
    drawings: [drawing],
  };
  const radarFx = fx({
    deaths: [{ x: 1, y: 2, line: null }],
    opening: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#f00" },
    trails: [{ points: [{ x: 0, y: 0 }], color: "#0f0", groupId: "g1" }],
    flashes: [{ x: 1, y: 1, intensity: 1, pulseRadius: 8, left: 0.4 }],
  });

  it("keeps a full stamp unchanged when every layer is on", () => {
    const snap = {
      pieces: [pawn, flash],
      groups: [pawnGroup, inkGroup],
      radarFx,
      drawings: [drawing],
    };
    expect(applySnapshotLayers(snap, DEFAULT_SNAPSHOT_LAYERS)).toEqual(snap);
  });

  it("drops pawns and their legend groups / trails", () => {
    const next = applySnapshotLayers(
      {
        pieces: [pawn, flash],
        groups: [pawnGroup, inkGroup],
        radarFx,
        drawings: [drawing],
      },
      { ...DEFAULT_SNAPSHOT_LAYERS, pawns: false },
    );
    expect(next.pieces.map((piece: Piece) => piece.kind)).toEqual(["flash"]);
    expect(next.groups?.map((group) => group.id)).toEqual(["ink"]);
    expect(next.radarFx?.trails).toEqual([]);
    expect(next.radarFx?.deaths).toHaveLength(1);
  });

  it("drops util tokens and flash overlays", () => {
    const next = applySnapshotLayers(
      { pieces: [pawn, flash], radarFx, drawings: [drawing] },
      { ...DEFAULT_SNAPSHOT_LAYERS, util: false },
    );
    expect(next.pieces.map((piece: Piece) => piece.kind)).toEqual(["pawn"]);
    expect(next.radarFx?.flashes).toEqual([]);
    expect(next.radarFx?.deaths).toHaveLength(1);
  });

  it("drops kill marks and keeps pawn trails", () => {
    const next = applySnapshotLayers(
      { pieces: [pawn], groups: [pawnGroup], radarFx },
      { ...DEFAULT_SNAPSHOT_LAYERS, kills: false },
    );
    expect(next.radarFx?.deaths).toEqual([]);
    expect(next.radarFx?.opening).toBeNull();
    expect(next.radarFx?.trails).toHaveLength(1);
    expect(next.groups).toEqual([pawnGroup]);
  });

  it("drops analyzer ink and drawing groups", () => {
    const next = applySnapshotLayers(
      {
        pieces: [pawn],
        groups: [pawnGroup, inkGroup],
        radarFx,
        drawings: [drawing],
      },
      { ...DEFAULT_SNAPSHOT_LAYERS, drawings: false },
    );
    expect(next.drawings).toBeUndefined();
    expect(next.groups).toEqual([pawnGroup]);
  });

  it("clears radarFx when every remaining overlay is empty", () => {
    const next = applySnapshotLayers(
      { pieces: [pawn], radarFx },
      { pawns: false, util: false, kills: false, drawings: false },
    );
    expect(next.radarFx).toBeUndefined();
    expect(next.pieces).toEqual([]);
  });
});
