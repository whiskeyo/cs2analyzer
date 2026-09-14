import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { ParseProgressPanel } from "./ParseProgressPanel";

function file(
  partial: Partial<ParseFileProgress> & Pick<ParseFileProgress, "index" | "name">,
): ParseFileProgress {
  return {
    state: "queued",
    pct: 0,
    ...partial,
  };
}

describe("ParseProgressPanel", () => {
  it("shows a single overall bar for one file", () => {
    render(<ParseProgressPanel overallPct={42} files={null} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.queryByText(/of \d+ files/)).not.toBeInTheDocument();
  });

  it("lists per-demo progress while a series parses", () => {
    const files: ParseFileProgress[] = [
      file({ index: 0, name: "a.dem", state: "done", pct: 100 }),
      file({ index: 1, name: "b.dem", state: "error", pct: 40 }),
      file({ index: 2, name: "c.dem", state: "queued", pct: 0 }),
      file({ index: 3, name: "d.dem", state: "parsing", pct: 55 }),
      file({ index: 4, name: "e.dem", state: "cancelled", pct: 10 }),
    ];
    render(<ParseProgressPanel overallPct={61} files={files} />);

    expect(screen.getByText("2 of 5 files · 61%")).toBeInTheDocument();
    expect(screen.getByText("a.dem")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("wires Cancel without activating a wrapping label", async () => {
    const onCancel = vi.fn();
    const onLabelClick = vi.fn();
    render(
      <label onClick={onLabelClick}>
        <ParseProgressPanel overallPct={10} files={null} onCancel={onCancel} />
      </label>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel parse" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onLabelClick).not.toHaveBeenCalled();
  });
});
