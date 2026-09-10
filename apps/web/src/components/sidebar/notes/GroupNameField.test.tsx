import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNote, groupItems, renameGroup } from "@/lib/notes";
import { GroupNameField } from "./GroupNameField";

const pen = { type: "pen" as const, color: "#fff", points: [{ x: 0, y: 0 }] };

describe("GroupNameField", () => {
  it("shows the group label", () => {
    const note = groupItems({ ...emptyNote(), drawings: [pen, { ...pen }] }, [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    render(
      <GroupNameField
        groupIndex={0}
        groupName={note.groups[0]?.name ?? ""}
        note={note}
        onNote={() => {}}
      />,
    );
    expect(screen.getByText(note.groups[0]?.name ?? "")).toBeInTheDocument();
  });

  it("renames the group on commit", async () => {
    const note = groupItems({ ...emptyNote(), drawings: [pen, { ...pen }] }, [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const onNote = vi.fn();
    render(
      <GroupNameField
        groupIndex={0}
        groupName={note.groups[0]?.name ?? ""}
        note={note}
        onNote={onNote}
      />,
    );
    await userEvent.dblClick(screen.getByTitle("Double-click to rename"));
    await userEvent.clear(screen.getByLabelText("Layer name"));
    await userEvent.type(screen.getByLabelText("Layer name"), "A exec{Enter}");
    expect(onNote).toHaveBeenCalledWith(renameGroup(note, 0, "A exec"));
  });
});
