import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNote } from "@/lib/notes/note";
import { makeReplay } from "@/lib/testing/fixtures";
import { Notes } from "./Notes";

describe("Notes", () => {
  it("shows the empty hint when there are no notes", () => {
    render(
      <Notes replay={makeReplay()} tick={0} notes={[]} onJump={() => {}} onNotes={() => {}} />,
    );
    expect(screen.getByText(/Draw or add a text box/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });

  it("exports a match PDF from the empty notes pane", async () => {
    const onExportPdf = vi.fn();
    render(
      <Notes
        replay={makeReplay()}
        tick={0}
        notes={[]}
        onJump={() => {}}
        onNotes={() => {}}
        onExportPdf={onExportPdf}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(onExportPdf).toHaveBeenCalledTimes(1);
  });

  it("renders the note list when notes exist", () => {
    const replay = makeReplay({
      rounds: [
        {
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          winner: "CT",
          win_reason: 8,
          score_ct: 0,
          score_t: 0,
          is_knife: false,
        },
      ],
    });
    render(
      <Notes
        replay={replay}
        tick={100}
        notes={[
          {
            round: 1,
            note: {
              ...emptyNote(),
              drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
              bookmarks: [{ color: "#fff", text: "Entry", tick: 100 }],
            },
          },
        ]}
        onJump={() => {}}
        onNotes={() => {}}
      />,
    );
    expect(screen.getByText(/Drag a layer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Squash" })).toBeInTheDocument();
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });
});
