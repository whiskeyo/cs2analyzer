import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROJECT_SCHEMA, type ReviewProject } from "@/lib/notes/projectStore";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { DropZone } from "./DropZone";

const noop = () => {};

function props(overrides: Partial<Parameters<typeof DropZone>[0]> = {}) {
  return {
    onFile: noop,
    onExportNotes: noop,
    onDeleteNotes: noop,
    parsing: false,
    progress: null,
    error: null,
    notice: null,
    saved: [],
    ...overrides,
  };
}

function savedProject(overrides: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
    key: "de_mirage|1|50,100|a.dem",
    savedAt: Date.now(),
    fileName: "a.dem",
    mapName: "de_mirage",
    tick: 120,
    strokes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
    ...overrides,
  };
}

describe("DropZone", () => {
  it("hands a picked demo to the parser", async () => {
    const onFile = vi.fn();
    const { container } = render(<DropZone {...props({ onFile })} />);

    const input = container.querySelector("input[type=file]");
    const demo = new File(["fake"], "match.dem");
    await userEvent.upload(input as HTMLInputElement, demo);

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].name).toBe("match.dem");
  });

  it("shows parse progress as a percentage", () => {
    render(<DropZone {...props({ parsing: true, progress: { current: 25, total: 200 } })} />);
    expect(screen.getByText("13%")).toBeInTheDocument();
  });

  it("keeps the progress bar hidden until a parse starts", () => {
    render(<DropZone {...props()} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("surfaces parse errors and notices", () => {
    render(
      <DropZone {...props({ error: "Supports only Source 2 replays", notice: "Restored" })} />,
    );
    expect(screen.getByText("Supports only Source 2 replays")).toBeInTheDocument();
    expect(screen.getByText("Restored")).toBeInTheDocument();
  });

  it("lists saved notes and asks for the demo that matches them", async () => {
    render(<DropZone {...props({ saved: [savedProject()] })} />);

    expect(screen.getByText("Mirage")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("a.dem"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Drop a.dem here to restore those drawings");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prints the scorecard on a saved note and keeps end-of-game stats for hover", () => {
    render(
      <DropZone
        {...props({
          saved: [
            savedProject({
              mapName: "de_inferno",
              fileName: "eyeballers-vs-phantom-m2-inferno.dem",
              scorecard: {
                teamA: "EYEBALLERS",
                teamB: "Phantom",
                scoreA: 17,
                scoreB: 19,
                firstHalf: { a: 6, b: 6 },
                secondHalf: { a: 6, b: 6 },
                overtime: { a: 5, b: 7 },
              },
              playerStats: [
                {
                  name: "s1mple",
                  start_side: "CT",
                  kills: 24,
                  deaths: 18,
                  adr: 88,
                  kast: 72,
                  rating: 1.23,
                },
              ],
            }),
          ],
        })}
      />,
    );

    expect(
      screen.getByText("Inferno: EYEBALLERS - Phantom, 17:19 (6:6, 6:6, OT 5:7)"),
    ).toBeInTheDocument();
    expect(screen.getByText("s1mple")).toBeInTheDocument();
    expect(screen.getByText("1.23")).toBeInTheDocument();
  });

  it("deletes saved notes by key", async () => {
    const onDeleteNotes = vi.fn();
    render(<DropZone {...props({ saved: [savedProject()], onDeleteNotes })} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteNotes).toHaveBeenCalledWith("de_mirage|1|50,100|a.dem");
  });

  it("disables the notes export until something is saved", () => {
    const { rerender } = render(<DropZone {...props()} />);
    expect(screen.getByRole("button", { name: "Export notes" })).toBeDisabled();

    rerender(<DropZone {...props({ saved: [savedProject()] })} />);
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
  });

  it("paginates saved notes ten at a time", async () => {
    const saved = Array.from({ length: 11 }, (_, i) =>
      savedProject({
        key: `de_mirage|1|50,100|${i}.dem`,
        fileName: `${i}.dem`,
      }),
    );
    render(<DropZone {...props({ saved })} />);

    expect(screen.getByText("0.dem")).toBeInTheDocument();
    expect(screen.queryByText("10.dem")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("10.dem")).toBeInTheDocument();
    expect(screen.queryByText("0.dem")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("links GitHub, Issues, and Donate in the footer", () => {
    render(<DropZone {...props()} />);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/whiskeyo/cs2analyzer",
    );
    expect(screen.getByRole("link", { name: "Issues" })).toHaveAttribute(
      "href",
      "https://github.com/whiskeyo/cs2analyzer/issues",
    );
    expect(screen.getByRole("link", { name: "Donate" })).toHaveAttribute(
      "href",
      "https://steamcommunity.com/tradeoffer/new/?partner=69520211&token=YCinud5X",
    );
  });
});
