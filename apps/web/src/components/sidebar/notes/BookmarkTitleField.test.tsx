import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renameStrokeText } from "@/lib/notes";
import { BookmarkTitleField } from "./BookmarkTitleField";

describe("BookmarkTitleField", () => {
  it("shows the bookmark title until double-clicked", () => {
    render(
      <BookmarkTitleField
        index={0}
        title="Entry timing"
        strokes={[{ type: "bookmark", round: 1, color: "#fff", text: "Entry timing" }]}
        onStrokes={() => {}}
      />,
    );
    expect(screen.getByText("Entry timing")).toBeInTheDocument();
  });

  it("renames on blur after editing", async () => {
    const strokes = [{ type: "bookmark" as const, round: 1, color: "#fff", text: "Old" }];
    const onStrokes = vi.fn();
    render(<BookmarkTitleField index={0} title="Old" strokes={strokes} onStrokes={onStrokes} />);
    await userEvent.dblClick(screen.getByText("Old"));
    const input = screen.getByLabelText("Bookmark name");
    await userEvent.clear(input);
    await userEvent.type(input, "New name");
    await userEvent.tab();
    expect(onStrokes).toHaveBeenCalledWith(renameStrokeText(strokes, 0, "New name"));
  });
});
