import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROJECT_SCHEMA, type ReviewProject } from "@/lib/notes/projectStore";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { DropZone } from "./DropZone";

vi.mock("@/lib/notes/projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notes/projectStore")>();
  return {
    ...actual,
    demoFilePickerAvailable: vi.fn(() => false),
    pickOpenFiles: vi.fn(),
  };
});

import { demoFilePickerAvailable, pickOpenFiles } from "@/lib/notes/projectStore";

const noop = () => {};

function props(overrides: Partial<Parameters<typeof DropZone>[0]> = {}) {
  return {
    onFiles: noop,
    onDeleteNotes: noop,
    onTryOpenSaved: async () => null,
    onLinkDemoFile: noop,
    parsing: false,
    progress: null,
    parseFiles: null,
    error: null,
    notice: null,
    saved: [],
    showSavedNotes: true,
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
    notes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
    ...overrides,
  };
}

describe("DropZone", () => {
  beforeEach(() => {
    vi.mocked(demoFilePickerAvailable).mockReturnValue(false);
    vi.mocked(pickOpenFiles).mockResolvedValue(null);
  });

  it("hands a picked demo to the parser", async () => {
    const onFiles = vi.fn();
    const { container } = render(<DropZone {...props({ onFiles })} />);

    const input = container.querySelector("input[type=file]");
    const demo = new File(["fake"], "match.dem");
    await userEvent.upload(input as HTMLInputElement, demo);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe("match.dem");
  });

  it("shows parse progress as a percentage", () => {
    render(<DropZone {...props({ parsing: true, progress: { current: 25, total: 200 } })} />);
    expect(screen.getByText("13%")).toBeInTheDocument();
  });

  it("keeps the progress bar hidden until a parse starts", () => {
    render(<DropZone {...props()} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("hides saved notes when the homepage drop zone is used", () => {
    render(<DropZone {...props({ showSavedNotes: false, saved: [savedProject()] })} />);
    expect(screen.queryByText("Saved notes")).not.toBeInTheDocument();
    expect(screen.queryByText("a.dem")).not.toBeInTheDocument();
  });

  it("renders optional beside and below slots around the drop card", () => {
    const { container } = render(
      <DropZone
        {...props({
          beside: <div className="home-playbook">Create a playbook</div>,
          below: <p className="home-faq-hint">see the FAQ</p>,
        })}
      />,
    );
    const drop = container.querySelector(".drop");
    const beside = container.querySelector(".home-playbook");
    const below = container.querySelector(".home-faq-hint");
    expect(drop).toBeTruthy();
    expect(beside).toBeTruthy();
    expect(below).toBeTruthy();
    if (drop && beside) {
      expect(drop.compareDocumentPosition(beside) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    if (beside && below) {
      expect(beside.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
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
                firstHalf: { a: 6, b: 6, ct: 6, t: 6 },
                secondHalf: { a: 6, b: 6, ct: 6, t: 6 },
                overtime: { a: 5, b: 7, ct: 5, t: 7 },
              },
              playerStats: [
                {
                  name: "device",
                  start_side: "T",
                  kills: 12,
                  deaths: 20,
                  adr: 60,
                  kast: 55,
                  rating: 0.81,
                },
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
      screen.getByLabelText("Inferno: EYEBALLERS - Phantom, 17:19 (6:6, 6:6, OT 5:7)"),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(/^s1mple/);
    expect(rows[2]).toHaveTextContent(/^device/);
  });

  it("deletes saved notes by key", async () => {
    const onDeleteNotes = vi.fn();
    render(<DropZone {...props({ saved: [savedProject()], onDeleteNotes })} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteNotes).toHaveBeenCalledWith("de_mirage|1|50,100|a.dem");
  });

  it("paginates saved notes five at a time", async () => {
    const saved = Array.from({ length: 11 }, (_, i) =>
      savedProject({
        key: `de_mirage|1|50,100|${i}.dem`,
        fileName: `${i}.dem`,
      }),
    );
    render(<DropZone {...props({ saved })} />);

    expect(screen.getByText("0.dem")).toBeInTheDocument();
    expect(screen.queryByText("5.dem")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("5.dem")).toBeInTheDocument();
    expect(screen.queryByText("0.dem")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
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
    expect(
      screen.getByText(
        (_, el) =>
          el?.textContent ===
          `Made by whiskeyo. Version: ${__APP_VERSION__}. Fan project — not affiliated with Valve or FACEIT. Radar overviews are Valve's, vendored from cs2-map-icons. Weapon icons from cs2-killfeed-generator (MIT) and counter-strike-icons.`,
      ),
    ).toBeInTheDocument();
  });

  it("accepts dropped demos on the main drop zone", async () => {
    const onFiles = vi.fn();
    const { container } = render(<DropZone {...props({ onFiles })} />);
    const drop = container.querySelector(".drop") as HTMLElement;
    const demo = new File(["fake"], "drop.dem");
    fireEvent.drop(drop, { dataTransfer: { files: [demo] } });
    await waitFor(() => expect(onFiles).toHaveBeenCalledTimes(1));
    expect(onFiles.mock.calls[0][0][0].name).toBe("drop.dem");
  });

  it("restores notes when the matching demo is dropped in the modal", async () => {
    const onFiles = vi.fn();
    const onTryOpenSaved = vi.fn(async () => null);
    render(<DropZone {...props({ saved: [savedProject()], onFiles, onTryOpenSaved })} />);

    await userEvent.click(screen.getByText("a.dem"));
    const dialog = screen.getByRole("dialog");
    const demo = new File(["fake"], "a.dem");
    fireEvent.drop(dialog, { dataTransfer: { files: [demo] } });

    await waitFor(() => expect(onFiles).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads a linked demo without opening the restore modal", async () => {
    const onFiles = vi.fn();
    const file = new File(["fake"], "a.dem");
    const onTryOpenSaved = vi.fn(async () => file);
    render(<DropZone {...props({ saved: [savedProject()], onFiles, onTryOpenSaved })} />);

    await userEvent.click(screen.getByText("a.dem"));
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows link-demo when the file picker API is available", async () => {
    vi.mocked(demoFilePickerAvailable).mockReturnValue(true);
    const onLinkDemoFile = vi.fn();
    render(<DropZone {...props({ saved: [savedProject()], onLinkDemoFile })} />);

    await userEvent.click(screen.getByRole("button", { name: "Link demo" }));
    expect(onLinkDemoFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: "a.dem" }));
  });

  it("uses the file picker on the drop zone when it is available", async () => {
    vi.mocked(demoFilePickerAvailable).mockReturnValue(true);
    const file = new File(["fake"], "picked.dem");
    const handle = { name: "picked.dem" } as FileSystemFileHandle;
    vi.mocked(pickOpenFiles).mockResolvedValue({ files: [file], handles: [handle] });
    const onFiles = vi.fn();
    const { container } = render(<DropZone {...props({ onFiles })} />);

    await userEvent.click(container.querySelector(".drop") as HTMLElement);
    expect(pickOpenFiles).toHaveBeenCalled();
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("shows saved metadata and paginates backward", async () => {
    const saved = Array.from({ length: 6 }, (_, i) =>
      savedProject({
        key: `de_mirage|1|50,100|${i}.dem`,
        fileName: i === 0 ? "" : `${i}.dem`,
        fileSizeBytes: 2 * 1024 * 1024,
        linkedFileLabel: "linked.dem",
        savedAt: 0,
        notes: [
          {
            round: 1,
            note: {
              groups: [],
              drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
              pieces: [],
              bookmarks: [],
            },
          },
        ],
      }),
    );
    render(<DropZone {...props({ saved })} />);

    expect(screen.getByText("unnamed.dem")).toBeInTheDocument();
    expect(screen.getAllByText(/1 drawing/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/2(\.0)? MB/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/linked: linked\.dem/)[0]).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("unnamed.dem")).toBeInTheDocument();
  });

  it("dismisses the restore modal when clicking the backdrop", async () => {
    render(<DropZone {...props({ saved: [savedProject()] })} />);
    await userEvent.click(screen.getByText("a.dem"));
    await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
