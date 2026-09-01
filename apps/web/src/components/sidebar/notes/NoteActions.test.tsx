import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { groupStrokes } from "@/lib/notes";
import { NoteActions } from "./NoteActions";

function twoPens() {
  return [
    { type: "pen" as const, round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
    { type: "pen" as const, round: 1, color: "#fff", points: [{ x: 1, y: 1 }] },
  ];
}

describe("NoteActions", () => {
  it("disables group actions without a valid selection", () => {
    render(
      <NoteActions
        strokes={twoPens()}
        selected={[]}
        canGroup={false}
        canUngroup={false}
        onStrokes={() => {}}
        onClearSelection={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Group" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Squash" })).toBeDisabled();
  });

  it("groups selected strokes", async () => {
    const strokes = twoPens();
    const onStrokes = vi.fn();
    const onClearSelection = vi.fn();
    render(
      <NoteActions
        strokes={strokes}
        selected={[0, 1]}
        canGroup
        canUngroup={false}
        onStrokes={onStrokes}
        onClearSelection={onClearSelection}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(onStrokes).toHaveBeenCalledWith(groupStrokes(strokes, [0, 1]));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("ungroups when a grouped stroke is selected", async () => {
    const grouped = groupStrokes(twoPens(), [0, 1]);
    const onStrokes = vi.fn();
    render(
      <NoteActions
        strokes={grouped}
        selected={[0]}
        canGroup={false}
        canUngroup
        onStrokes={onStrokes}
        onClearSelection={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ungroup" }));
    expect(onStrokes).toHaveBeenCalled();
  });

  it("squashes selected strokes", async () => {
    const strokes = twoPens();
    const onStrokes = vi.fn();
    render(
      <NoteActions
        strokes={strokes}
        selected={[0, 1]}
        canGroup
        canUngroup={false}
        onStrokes={onStrokes}
        onClearSelection={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Squash" }));
    expect(onStrokes).toHaveBeenCalled();
  });
});
