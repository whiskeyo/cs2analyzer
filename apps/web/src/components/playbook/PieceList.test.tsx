/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { makePiece } from "@/lib/playbook/pieces";
import { PieceList } from "./PieceList";

describe("PieceList", () => {
  it("shows an empty hint when there is nothing on the radar", () => {
    render(
      <PieceList
        note={emptyNote()}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
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
    render(
      <PieceList
        note={note}
        selectedId="p1"
        onSelect={onSelect}
        onRename={onRename}
        onRemove={onRemove}
      />,
    );
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
    render(
      <PieceList
        note={note}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove FK/FD" }));
    expect(onRemove).toHaveBeenCalledWith("fx:opening");
    fireEvent.click(screen.getByRole("button", { name: "Remove Flash" }));
    expect(onRemove).toHaveBeenCalledWith("fx:flash:0");
  });
});
