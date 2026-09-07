import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makePiece } from "@/lib/playbook/pieces";
import { PieceList } from "./PieceList";

describe("PieceList", () => {
  it("shows an empty hint when there are no tokens", () => {
    render(
      <PieceList
        pieces={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/No tokens yet/)).toBeInTheDocument();
  });

  it("selects, renames, and removes a token", () => {
    const onSelect = vi.fn();
    const onRename = vi.fn();
    const onRemove = vi.fn();
    const pieces = [
      makePiece("pawn", 0, 0, { id: "p1", side: "CT", label: "entry" }),
      makePiece("smoke", 1, 1, { id: "s1" }),
    ];
    render(
      <PieceList
        pieces={pieces}
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
    expect(onRemove).toHaveBeenCalledWith("p1");
  });
});
