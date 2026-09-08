/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { makePiece } from "@/lib/playbook/pieces";
import { PieceList } from "./PieceList";

function listProps(overrides: Partial<Parameters<typeof PieceList>[0]> = {}) {
  return {
    note: emptyNote(),
    selectedId: null as string | null,
    picked: new Set<string>(),
    onTogglePick: vi.fn(),
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onRenameGroup: vi.fn(),
    onToggleGroup: vi.fn(),
    onUngroup: vi.fn(),
    ...overrides,
  };
}

describe("PieceList", () => {
  it("shows an empty hint when there is nothing on the radar", () => {
    render(<PieceList {...listProps()} />);
    expect(screen.getByText(/Nothing on the radar yet/)).toBeInTheDocument();
  });

  it("selects, renames, and removes a token", () => {
    const onSelect = vi.fn();
    const onRename = vi.fn();
    const onRemove = vi.fn();
    const note = emptyNote();
    note.pieces.push(
      makePiece("pawn", 0, 0, { id: "p1", side: "CT", label: "entry" }),
      makePiece("smoke", 1, 1, { id: "s1" }),
    );
    render(<PieceList {...listProps({ note, selectedId: "p1", onSelect, onRename, onRemove })} />);
    expect(screen.getByRole("button", { name: "Pawn" })).toHaveClass("is-active");
    fireEvent.click(screen.getByRole("button", { name: "Smoke" }));
    expect(onSelect).toHaveBeenCalledWith("s1");
    fireEvent.change(screen.getByRole("textbox", { name: "Label entry" }), {
      target: { value: "lurk" },
    });
    expect(onRename).toHaveBeenCalledWith("p1", "lurk");
    fireEvent.click(screen.getByRole("button", { name: "Remove entry" }));
    expect(onRemove).toHaveBeenCalledWith("piece:p1");
  });

  it("lists snapshot marks so they can be deleted", () => {
    const onRemove = vi.fn();
    const note = emptyNote();
    note.radarFx = {
      deaths: [],
      opening: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#ff0" },
      tracers: [],
      trails: [],
      heatmap: [],
      summary: [],
      cone: null,
      hits: [],
      flashes: [{ x: 1, y: 1, intensity: 1, pulseRadius: 4, left: 1 }],
    };
    render(<PieceList {...listProps({ note, onRemove })} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove FK/FD" }));
    expect(onRemove).toHaveBeenCalledWith("fx:opening");
    fireEvent.click(screen.getByRole("button", { name: "Remove Flash" }));
    expect(onRemove).toHaveBeenCalledWith("fx:flash:0");
  });

  it("nests tokens under a named group", () => {
    const note = emptyNote();
    note.groups.push({ id: "g1", name: "Smoke", drawings: [], hidden: true });
    note.pieces.push(makePiece("smoke", 0, 0, { id: "s1", groupId: "g1" }));
    render(<PieceList {...listProps({ note })} />);
    expect(screen.getByRole("textbox", { name: "Group Smoke" })).toHaveValue("Smoke");
    expect(screen.getByRole("button", { name: "Show Smoke" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smoke" })).toBeInTheDocument();
  });
});
