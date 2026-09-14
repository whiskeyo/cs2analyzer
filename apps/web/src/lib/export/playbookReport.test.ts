import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  addPage,
  newPlaybook,
  setPageBody,
  setPageFloor,
  setPageLayerImages,
  setPageLayerVideos,
  setPageVideos,
} from "@/lib/playbook/pages";
import type { PlaybookImage } from "@/lib/playbook/types";
import { YOUTUBE_UNTITLED } from "@/lib/playbook/youtube";
import {
  formatPlaybookExportDate,
  playbookPageClips,
  playbookPagePhotos,
  playbookPdfFilename,
  playbookReportClipLine,
  playbookPdfHeading,
  playbookPdfStem,
  playbookReport,
} from "./playbookReport";

const EXPORTED_AT = Date.UTC(2026, 8, 12, 15, 0, 0);

function video(partial: {
  id?: string;
  videoId?: string;
  url?: string;
  title?: string;
  startSeconds?: number;
}) {
  return {
    id: partial.id ?? "v1",
    videoId: partial.videoId ?? "abcdefghijk",
    url: partial.url ?? "",
    title: partial.title ?? "",
    x: 0,
    y: 0,
    ...(partial.startSeconds != null ? { startSeconds: partial.startSeconds } : {}),
  };
}

describe("formatPlaybookExportDate", () => {
  it("prints a UTC calendar day", () => {
    expect(formatPlaybookExportDate(EXPORTED_AT)).toBe("12 Sept 2026");
  });
});

describe("playbookPdfHeading", () => {
  it("joins the human map name and playbook title", () => {
    expect(playbookPdfHeading("Nuke", "default executes")).toBe("Nuke: default executes");
  });
});

describe("playbookPdfStem", () => {
  it("slugs map and title", () => {
    expect(playbookPdfStem("A execs", "Dust II")).toBe("dust-ii-a-execs");
    expect(playbookPdfStem("  ", "???")).toBe("playbook");
  });
});

describe("playbookReport", () => {
  it("builds cover fields and one section per strat", () => {
    let book = newPlaybook("de_mirage", "A execs");
    const first = book.pages[0]!;
    book = setPageBody(book, first.id, "  Smoke stairs, flash mid.  ");
    book = setPageVideos(book, first.id, [
      video({
        title: `${YOUTUBE_UNTITLED} lineup`,
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        startSeconds: 12,
      }),
      video({ id: "v2", videoId: "", title: "  ", url: "  " }),
    ]);
    book = addPage(book, "Mid control");
    const second = book.pages[1]!;
    book = setPageBody(book, second.id, "");
    book = {
      ...book,
      pages: book.pages.map((page) =>
        page.id === first.id
          ? {
              ...page,
              note: {
                ...emptyNote(),
                drawings: [{ type: "text", color: "#fff", x: 1, y: 2, text: "on radar" }],
              },
            }
          : page,
      ),
    };

    const report = playbookReport(book, EXPORTED_AT);
    expect(report.title).toBe("A execs");
    expect(report.mapName).toBe("de_mirage");
    expect(report.mapLabel).toBe("Mirage");
    expect(report.heading).toBe("Mirage: A execs");
    expect(report.exportedOn).toBe("12 Sept 2026");
    expect(report.fileStem).toBe("mirage-a-execs");
    expect(playbookPdfFilename(report)).toBe("mirage-a-execs.pdf");
    expect(report.pages).toHaveLength(2);
    expect(report.pages[0]).toMatchObject({
      id: first.id,
      title: "Untitled strat",
      body: "Smoke stairs, flash mid.",
      clips: [
        {
          title: `${YOUTUBE_UNTITLED} lineup`,
          url: "https://www.youtube.com/watch?v=abcdefghijk",
          x: 0,
          y: 0,
          floor: "upper",
          index: 1,
        },
      ],
      photos: [],
    });
    expect(report.pages[0]?.note.drawings).toHaveLength(1);
    expect(report.pages[1]).toMatchObject({
      id: second.id,
      title: "Mid control",
      body: "",
      clips: [],
      photos: [],
    });
  });

  it("lists current-floor photos first, then the other floor", () => {
    let book = newPlaybook("de_nuke", "Nuke execs");
    const page = book.pages[0]!;
    const upper: PlaybookImage = {
      id: "up",
      name: "upper.png",
      mime: "image/png",
      x: 0,
      y: 0,
    };
    const lower: PlaybookImage = {
      id: "lo",
      name: "lower.png",
      mime: "image/png",
      x: 1,
      y: 1,
    };
    book = setPageLayerImages(book, page.id, "upper", [upper]);
    book = setPageLayerImages(book, page.id, "lower", [lower]);
    expect(playbookPagePhotos(book.pages[0]!).map((photo) => photo.id)).toEqual(["up", "lo"]);
    book = setPageFloor(book, page.id, "lower");
    expect(playbookPagePhotos(book.pages[0]!).map((photo) => photo.id)).toEqual(["lo", "up"]);
    expect(playbookReport(book, EXPORTED_AT).pages[0]?.photos).toEqual([
      { id: "lo", name: "lower.png", mime: "image/png", x: 1, y: 1, floor: "lower" },
      { id: "up", name: "upper.png", mime: "image/png", x: 0, y: 0, floor: "upper" },
    ]);
  });

  it("rebuilds a watch URL when the clip only stored a video id", () => {
    let book = newPlaybook("de_inferno", "Defaults");
    const page = book.pages[0]!;
    book = setPageVideos(book, page.id, [
      video({
        title: "Window",
        url: "",
        videoId: "dQw4w9wgxcQ",
        startSeconds: 30,
      }),
    ]);
    expect(playbookReport(book, EXPORTED_AT).pages[0]?.clips).toEqual([
      {
        title: "Window",
        url: "https://www.youtube.com/watch?v=dQw4w9wgxcQ&t=30",
        x: 0,
        y: 0,
        floor: "upper",
        index: 1,
      },
    ]);
  });

  it("numbers clips 1-based per floor and lists the current floor first", () => {
    let book = newPlaybook("de_nuke", "Nuke execs");
    const page = book.pages[0]!;
    book = setPageVideos(book, page.id, [
      video({ id: "u1", title: "Window lineup" }),
      video({ id: "u2", title: "Palace smoke", videoId: "bbbbbbbbbbb" }),
    ]);
    book = setPageLayerVideos(book, page.id, "lower", [video({ id: "l1", title: "Ramp" })]);
    expect(playbookPageClips(book.pages[0]!).map((clip) => playbookReportClipLine(clip))).toEqual([
      "1 - Window lineup",
      "2 - Palace smoke",
      "1 - Ramp",
    ]);
    book = setPageFloor(book, page.id, "lower");
    expect(playbookPageClips(book.pages[0]!).map((clip) => clip.floor)).toEqual([
      "lower",
      "upper",
      "upper",
    ]);
    expect(
      playbookReportClipLine({ title: "", url: "", x: 0, y: 0, floor: "upper", index: 1 }),
    ).toBe(`1 - ${YOUTUBE_UNTITLED}`);
  });
});
