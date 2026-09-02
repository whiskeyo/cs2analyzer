import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewNote } from "@/lib/match/review";
import { ReviewNoteFlow } from "./ReviewNoteFlow";

function note(
  tick: number,
  roundLabel: string,
  severity: ReviewNote["severity"],
  title = roundLabel,
): ReviewNote {
  return { tick, roundLabel, title, detail: "", severity, kind: "death" };
}

const FLOW: ReviewNote[] = [
  note(100, "R1", "low"),
  note(200, "R2", "high"),
  note(300, "R3", "high"),
  note(400, "R4", "low"),
  note(700, "R7", "good"),
  note(1500, "R15", "high"),
];

function titles(): string[] {
  return screen
    .getAllByRole("button")
    .filter((el) => el.className.includes("review-note"))
    .map((el) => el.querySelector(".review-title")?.textContent ?? "");
}

describe("ReviewNoteFlow", () => {
  it("renders nothing when there are no notes", () => {
    const { container } = render(<ReviewNoteFlow notes={[]} onJump={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to round order and can sort worst-first by severity", async () => {
    render(<ReviewNoteFlow notes={FLOW} onJump={() => {}} />);
    expect(screen.getByRole("button", { name: "Round" })).toHaveClass("on");
    expect(titles()).toEqual(["R1", "R2", "R3", "R4", "R7", "R15"]);

    await userEvent.click(screen.getByRole("button", { name: "Severity" }));
    expect(screen.getByRole("button", { name: "Severity" })).toHaveClass("on");
    expect(titles()).toEqual(["R2", "R3", "R15", "R1", "R4", "R7"]);

    await userEvent.click(screen.getByRole("button", { name: "Round" }));
    expect(titles()).toEqual(["R1", "R2", "R3", "R4", "R7", "R15"]);
  });

  it("dims notes after the playhead and jumps with the note", async () => {
    const onJump = vi.fn();
    render(<ReviewNoteFlow notes={FLOW} pendingAtTick={250} onJump={onJump} />);
    const rows = screen.getAllByRole("button").filter((el) => el.className.includes("review-note"));
    expect(
      rows.filter((row) => row.className.includes("pending")).map((row) => row.textContent),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("R3"), expect.stringContaining("R15")]),
    );
    expect(rows.find((row) => row.textContent?.includes("R1"))?.className).not.toContain("pending");

    await userEvent.click(rows[1]!);
    expect(onJump).toHaveBeenCalledWith(FLOW[1]);
  });
});
