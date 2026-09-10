import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNote, groupItems } from "@/lib/notes";
import { NoteActions } from "./NoteActions";
import type { RoundNote } from "@/lib/notes/types";

const pen = { type: "pen" as const, color: "#fff", points: [{ x: 0, y: 0 }] };

function twoPens(): RoundNote[] {
  return [
    { round: 1, note: { ...emptyNote(), drawings: [pen, { ...pen, points: [{ x: 1, y: 1 }] }] } },
  ];
}

const picks = [
  { round: 1, ref: { kind: "loose" as const, index: 0 } },
  { round: 1, ref: { kind: "loose" as const, index: 1 } },
];

describe("NoteActions", () => {
  it("disables group actions without a valid selection", () => {
    render(
      <NoteActions
        notes={twoPens()}
        selected={[]}
        canGroup={false}
        canUngroup={false}
        onNotes={() => {}}
        onClearSelection={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Group" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Squash" })).toBeDisabled();
  });

  it("groups selected drawings", async () => {
    const notes = twoPens();
    const onNotes = vi.fn();
    const onClearSelection = vi.fn();
    render(
      <NoteActions
        notes={notes}
        selected={picks}
        canGroup
        canUngroup={false}
        onNotes={onNotes}
        onClearSelection={onClearSelection}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(onNotes).toHaveBeenCalledWith([
      expect.objectContaining({
        note: expect.objectContaining({
          groups: [expect.objectContaining({ drawings: expect.any(Array) })],
        }),
      }),
    ]);
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("ungroups when a grouped drawing is selected", async () => {
    const grouped = groupItems(twoPens()[0].note, [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const onNotes = vi.fn();
    render(
      <NoteActions
        notes={[{ round: 1, note: grouped }]}
        selected={[{ round: 1, ref: { kind: "group", groupIndex: 0, drawingIndex: 0 } }]}
        canGroup={false}
        canUngroup
        onNotes={onNotes}
        onClearSelection={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ungroup" }));
    expect(onNotes).toHaveBeenCalled();
  });

  it("squashes selected drawings", async () => {
    const onNotes = vi.fn();
    render(
      <NoteActions
        notes={twoPens()}
        selected={picks}
        canGroup
        canUngroup={false}
        onNotes={onNotes}
        onClearSelection={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Squash" }));
    expect(onNotes).toHaveBeenCalled();
  });
});
