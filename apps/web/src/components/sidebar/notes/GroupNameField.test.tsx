import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { groupStrokes, renameGroup } from "@/lib/notes";
import { GroupNameField } from "./GroupNameField";

describe("GroupNameField", () => {
  it("shows the group label", () => {
    const strokes = groupStrokes(
      [
        { type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
        { type: "pen", round: 1, color: "#fff", points: [{ x: 1, y: 1 }] },
      ],
      [0, 1],
    );
    const groupId = strokes[0].group ?? "";
    render(<GroupNameField groupId={groupId} strokes={strokes} onStrokes={() => {}} />);
    expect(screen.getByText("Group 1")).toBeInTheDocument();
  });

  it("renames the group on commit", async () => {
    const strokes = groupStrokes(
      [
        { type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
        { type: "pen", round: 1, color: "#fff", points: [{ x: 1, y: 1 }] },
      ],
      [0, 1],
    );
    const groupId = strokes[0].group ?? "";
    const onStrokes = vi.fn();
    render(<GroupNameField groupId={groupId} strokes={strokes} onStrokes={onStrokes} />);
    await userEvent.dblClick(screen.getByText("Group 1"));
    const input = screen.getByLabelText("Layer name");
    await userEvent.clear(input);
    await userEvent.type(input, "A exec");
    await userEvent.tab();
    expect(onStrokes).toHaveBeenCalledWith(renameGroup(strokes, groupId, "A exec"));
  });
});
