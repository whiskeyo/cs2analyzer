import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNote, renameItemText } from "@/lib/notes";
import { BookmarkTitleField } from "./BookmarkTitleField";

describe("BookmarkTitleField", () => {
  it("shows the title", () => {
    render(
      <BookmarkTitleField
        refItem={{ kind: "bookmark", index: 0 }}
        title="Entry timing"
        note={{ ...emptyNote(), bookmarks: [{ color: "#fff", text: "Entry timing", tick: 1 }] }}
        onNote={() => {}}
      />,
    );
    expect(screen.getByText("Entry timing")).toBeInTheDocument();
  });

  it("renames the bookmark on commit", async () => {
    const note = { ...emptyNote(), bookmarks: [{ color: "#fff", text: "Old", tick: 1 }] };
    const onNote = vi.fn();
    render(
      <BookmarkTitleField
        refItem={{ kind: "bookmark", index: 0 }}
        title="Old"
        note={note}
        onNote={onNote}
      />,
    );
    await userEvent.dblClick(screen.getByTitle("Double-click to rename"));
    await userEvent.clear(screen.getByLabelText("Bookmark name"));
    await userEvent.type(screen.getByLabelText("Bookmark name"), "New name{Enter}");
    expect(onNote).toHaveBeenCalledWith(
      renameItemText(note, { kind: "bookmark", index: 0 }, "New name"),
    );
  });
});
