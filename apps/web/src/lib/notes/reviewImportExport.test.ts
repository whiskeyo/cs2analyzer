import { afterEach, describe, expect, it, vi } from "vitest";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";
import { loadedDemo } from "@/lib/parse/session";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { DEFAULT_SUMMARY_FILTER } from "./types";
import type { ReviewProject } from "./projectStore";
import {
  exportSavedNotes,
  importNotesFromText,
  linkDemoFile,
  linkedDemoPermissionNotice,
  removeAllSavedNotes,
  tryOpenLinkedDemo,
  type ReviewImportContext,
} from "./reviewImportExport";

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  deleteAllProjects: vi.fn(),
  importProjects: vi.fn(),
  parseBundle: vi.fn(),
  serializeBundle: vi.fn(),
  matchKey: vi.fn(),
  loadDemoFileHandle: vi.fn(),
  readFileFromHandle: vi.fn(),
  demoFilePickerAvailable: vi.fn(),
  pickDemoFileHandle: vi.fn(),
  saveDemoFileHandle: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: mocks.downloadBlob,
}));

vi.mock("./projectStore", () => ({
  deleteAllProjects: mocks.deleteAllProjects,
  importProjects: mocks.importProjects,
  parseBundle: mocks.parseBundle,
  serializeBundle: mocks.serializeBundle,
  matchKey: mocks.matchKey,
  loadDemoFileHandle: mocks.loadDemoFileHandle,
  readFileFromHandle: mocks.readFileFromHandle,
  demoFilePickerAvailable: mocks.demoFilePickerAvailable,
  pickDemoFileHandle: mocks.pickDemoFileHandle,
  saveDemoFileHandle: mocks.saveDemoFileHandle,
  loadProject: mocks.loadProject,
  saveProject: mocks.saveProject,
}));

function status() {
  const s = { error: null as string | null, notice: null as string | null };
  return {
    get error() {
      return s.error;
    },
    get notice() {
      return s.notice;
    },
    setError: (message: string | null) => {
      s.error = message;
    },
    setNotice: (message: string | null | ((prev: string | null) => string | null)) => {
      s.notice = typeof message === "function" ? message(s.notice) : message;
    },
  };
}

function project(partial: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: 2,
    key: "de_mirage|1|50,100|match.dem",
    savedAt: 1,
    fileName: "match.dem",
    mapName: "de_mirage",
    tick: 100,
    notes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: "default",
    color: "#ff1744",
    ...partial,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exportSavedNotes", () => {
  it("notices when there is nothing to export", async () => {
    const s = status();
    await exportSavedNotes(async () => [], s);
    expect(s.notice).toBe("No saved notes in this browser yet.");
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it("downloads a bundle and reports the count", async () => {
    const s = status();
    const projects = [project(), project({ key: "other" })];
    mocks.serializeBundle.mockReturnValue('{"schema":2}');
    await exportSavedNotes(async () => projects, s);
    expect(mocks.serializeBundle).toHaveBeenCalledWith(projects);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      "cs2analyzer-notes.json",
      "application/json",
      '{"schema":2}',
    );
    expect(s.notice).toBe("Exported 2 saved matches.");
  });

  it("uses singular copy for one project", async () => {
    const s = status();
    mocks.serializeBundle.mockReturnValue("{}");
    await exportSavedNotes(async () => [project()], s);
    expect(s.notice).toBe("Exported 1 saved match.");
  });

  it("surfaces export failures", async () => {
    const s = status();
    await exportSavedNotes(async () => {
      throw new Error("idb");
    }, s);
    expect(s.error).toBe("Could not export notes.");
  });
});

describe("removeAllSavedNotes", () => {
  it("refreshes and notices when nothing was stored", async () => {
    const s = status();
    const refresh = vi.fn();
    mocks.deleteAllProjects.mockResolvedValue(0);
    await removeAllSavedNotes(refresh, s);
    expect(refresh).toHaveBeenCalledOnce();
    expect(s.notice).toBe("No saved notes in this browser.");
  });

  it("reports how many rows were removed", async () => {
    const s = status();
    mocks.deleteAllProjects.mockResolvedValue(3);
    await removeAllSavedNotes(vi.fn(), s);
    expect(s.notice).toBe("Removed 3 saved matches from this browser.");
  });

  it("surfaces delete failures", async () => {
    const s = status();
    mocks.deleteAllProjects.mockRejectedValue(new Error("fail"));
    await removeAllSavedNotes(vi.fn(), s);
    expect(s.error).toBe("Could not remove saved notes.");
  });
});

describe("importNotesFromText", () => {
  it("rejects invalid JSON", async () => {
    const s = status();
    const ctx: ReviewImportContext = {
      demo: null,
      applyProject: vi.fn(),
      refreshSaved: vi.fn(),
      status: s,
    };
    await importNotesFromText("{not json", ctx);
    expect(s.error).toBe("Notes file is not valid JSON.");
  });

  it("rejects an empty bundle", async () => {
    const s = status();
    mocks.parseBundle.mockReturnValue(null);
    const ctx: ReviewImportContext = {
      demo: null,
      applyProject: vi.fn(),
      refreshSaved: vi.fn(),
      status: s,
    };
    await importNotesFromText("{}", ctx);
    expect(s.error).toBe("Notes file has no valid reviews.");
  });

  it("imports projects and applies the row for the loaded demo", async () => {
    const s = status();
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
      players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
    });
    const demo = loadedDemo(replay, "match.dem", new File([], "match.dem"));
    const row = project();
    const bundle = { schema: 2, exportedAt: 1, projects: [row] };
    mocks.parseBundle.mockReturnValue(bundle);
    mocks.importProjects.mockResolvedValue(1);
    mocks.matchKey.mockReturnValue(row.key);
    const applyProject = vi.fn();
    const refreshSaved = vi.fn();
    const ctx: ReviewImportContext = { demo, applyProject, refreshSaved, status: s };
    await importNotesFromText('{"schema":2}', ctx);
    expect(mocks.importProjects).toHaveBeenCalledWith(bundle);
    expect(refreshSaved).toHaveBeenCalledOnce();
    expect(s.error).toBeNull();
    expect(s.notice).toBe("Imported 1 saved match. Drop the demo to restore drawings.");
    expect(applyProject).toHaveBeenCalledWith(row, false);
  });

  it("skips apply when the loaded demo has no matching key", async () => {
    const s = status();
    const demo = loadedDemo(makeReplay(), "other.dem", new File([], "other.dem"));
    mocks.parseBundle.mockReturnValue({ schema: 2, exportedAt: 1, projects: [project()] });
    mocks.importProjects.mockResolvedValue(1);
    mocks.matchKey.mockReturnValue("different-key");
    const applyProject = vi.fn();
    await importNotesFromText("{}", {
      demo,
      applyProject,
      refreshSaved: vi.fn(),
      status: s,
    });
    expect(applyProject).not.toHaveBeenCalled();
  });

  it("imports without applying when no demo is loaded", async () => {
    const s = status();
    mocks.parseBundle.mockReturnValue({ schema: 2, exportedAt: 1, projects: [project()] });
    mocks.importProjects.mockResolvedValue(1);
    const applyProject = vi.fn();
    await importNotesFromText("{}", {
      demo: null,
      applyProject,
      refreshSaved: vi.fn(),
      status: s,
    });
    expect(applyProject).not.toHaveBeenCalled();
    expect(s.notice).toContain("Imported 1 saved match");
  });

  it("surfaces quota when import cannot write", async () => {
    const s = status();
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    mocks.parseBundle.mockReturnValue({ schema: 2, exportedAt: 1, projects: [project()] });
    mocks.importProjects.mockRejectedValue(quota);
    await importNotesFromText("{}", {
      demo: null,
      applyProject: vi.fn(),
      refreshSaved: vi.fn(),
      status: s,
    });
    expect(s.error).toBe(IDB_QUOTA_MESSAGE);
    expect(s.notice).toBeNull();
  });
});

describe("tryOpenLinkedDemo", () => {
  it("returns null when no file is linked", async () => {
    mocks.loadDemoFileHandle.mockResolvedValue(null);
    expect(await tryOpenLinkedDemo(project(), status())).toBeNull();
    expect(mocks.readFileFromHandle).not.toHaveBeenCalled();
  });

  it("notices when a linked handle has lost read permission", async () => {
    const s = status();
    mocks.loadDemoFileHandle.mockResolvedValue({ name: "match.dem" });
    mocks.readFileFromHandle.mockResolvedValue(null);
    expect(await tryOpenLinkedDemo(project({ fileName: "match.dem" }), s)).toBeNull();
    expect(s.notice).toBe(linkedDemoPermissionNotice("match.dem"));
    expect(s.error).toBeNull();
  });

  it("errors when the linked filename does not match", async () => {
    const s = status();
    mocks.loadDemoFileHandle.mockResolvedValue({ name: "wrong.dem" });
    mocks.readFileFromHandle.mockResolvedValue(new File([], "wrong.dem"));
    expect(await tryOpenLinkedDemo(project({ fileName: "match.dem" }), s)).toBeNull();
    expect(s.error).toContain("wrong.dem");
    expect(s.error).toContain("match.dem");
  });

  it("returns the linked file when names match", async () => {
    const file = new File([], "match.dem");
    mocks.loadDemoFileHandle.mockResolvedValue({ name: "match.dem" });
    mocks.readFileFromHandle.mockResolvedValue(file);
    expect(await tryOpenLinkedDemo(project({ fileName: "match.dem" }), status())).toBe(file);
  });
});

describe("linkDemoFile", () => {
  it("notices when the file picker is unavailable", async () => {
    const s = status();
    mocks.demoFilePickerAvailable.mockReturnValue(false);
    await linkDemoFile(project(), vi.fn(), s);
    expect(s.notice).toContain("Chrome/Edge");
    expect(mocks.pickDemoFileHandle).not.toHaveBeenCalled();
  });

  it("returns quietly when the picker is cancelled", async () => {
    const s = status();
    mocks.demoFilePickerAvailable.mockReturnValue(true);
    mocks.pickDemoFileHandle.mockResolvedValue(null);
    await linkDemoFile(project(), vi.fn(), s);
    expect(s.error).toBeNull();
    expect(s.notice).toBeNull();
  });

  it("errors when the selected file name does not match", async () => {
    const s = status();
    mocks.demoFilePickerAvailable.mockReturnValue(true);
    mocks.pickDemoFileHandle.mockResolvedValue({ name: "other.dem" });
    await linkDemoFile(project({ fileName: "match.dem" }), vi.fn(), s);
    expect(s.error).toContain("match.dem");
    expect(s.error).toContain("other.dem");
  });

  it("saves the handle and refreshes on success", async () => {
    const s = status();
    const refresh = vi.fn();
    const row = project();
    const handle = { name: "match.dem" };
    mocks.demoFilePickerAvailable.mockReturnValue(true);
    mocks.pickDemoFileHandle.mockResolvedValue(handle);
    mocks.loadProject.mockResolvedValue(row);
    mocks.saveDemoFileHandle.mockResolvedValue(undefined);
    mocks.saveProject.mockResolvedValue(undefined);
    await linkDemoFile(row, refresh, s);
    expect(mocks.saveDemoFileHandle).toHaveBeenCalledWith(row.key, handle);
    expect(mocks.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ linkedFileLabel: "match.dem" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(s.notice).toBe("Linked match.dem for saved notes.");
  });

  it("notices when linking is cancelled via exception", async () => {
    const s = status();
    mocks.demoFilePickerAvailable.mockReturnValue(true);
    mocks.pickDemoFileHandle.mockRejectedValue(new Error("abort"));
    await linkDemoFile(project(), vi.fn(), s);
    expect(s.notice).toBe("Demo link cancelled.");
  });

  it("surfaces quota instead of treating it as a cancelled picker", async () => {
    const s = status();
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    mocks.demoFilePickerAvailable.mockReturnValue(true);
    mocks.pickDemoFileHandle.mockResolvedValue({ name: "match.dem" });
    mocks.saveDemoFileHandle.mockRejectedValue(quota);
    await linkDemoFile(project(), vi.fn(), s);
    expect(s.error).toBe(IDB_QUOTA_MESSAGE);
    expect(s.notice).toBeNull();
  });
});
