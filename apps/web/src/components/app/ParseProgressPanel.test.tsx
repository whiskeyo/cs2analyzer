import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { en } from "@/lib/i18n/translations/en";
import { t } from "@/lib/i18n/messages";
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
    expect(screen.getByText(t(en.parse.percent, { pct: 42 }))).toBeInTheDocument();
    expect(screen.queryByText(/Overall/)).not.toBeInTheDocument();
  });

  it("lists per-demo progress while a series parses", () => {
    const files: ParseFileProgress[] = [
      file({ index: 0, name: "a.dem", state: "done", pct: 100 }),
      file({ index: 1, name: "b.dem", state: "error", pct: 40 }),
      file({ index: 2, name: "c.dem", state: "queued", pct: 0 }),
      file({ index: 3, name: "d.dem", state: "parsing", pct: 55 }),
    ];
    render(<ParseProgressPanel overallPct={61} files={files} />);

    expect(screen.getByText(t(en.parse.overall, { pct: 61 }))).toBeInTheDocument();
    expect(screen.getByText("a.dem")).toBeInTheDocument();
    expect(screen.getByText(en.parse.done)).toBeInTheDocument();
    expect(screen.getByText(en.parse.error)).toBeInTheDocument();
    expect(screen.getByText(en.parse.queued)).toBeInTheDocument();
    expect(screen.getByText(t(en.parse.percent, { pct: 55 }))).toBeInTheDocument();
  });
});
