import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeReplay } from "@/lib/testing/fixtures";
import { Notes } from "./Notes";

describe("Notes", () => {
  it("shows the empty hint when there are no strokes", () => {
    render(
      <Notes replay={makeReplay()} tick={0} strokes={[]} onJump={() => {}} onStrokes={() => {}} />,
    );
    expect(screen.getByText(/Draw or add a text box/)).toBeInTheDocument();
  });

  it("renders the note list when strokes exist", () => {
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
        strokes={[
          { type: "bookmark", round: 1, color: "#fff", text: "Entry" },
          { type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
        ]}
        onJump={() => {}}
        onStrokes={() => {}}
      />,
    );
    expect(screen.getByText(/Drag a layer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Squash" })).toBeInTheDocument();
    expect(screen.getByText("Round 1")).toBeInTheDocument();
  });
});
