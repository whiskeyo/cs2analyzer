/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOK_EXPORT_FILE } from "./transfer";
import { newPlaybook } from "./pages";
import {
  createPlaybook,
  deleteAllPlaybooks,
  loadAllPlaybooks,
  loadPlaybook,
} from "./playbookStore";
import * as playbookStore from "./playbookStore";
import { setPageImages } from "./pages";
import { getPlaybookImageBlob, putPlaybookImageBlob } from "./playbookImageStore";
import { PLAYBOOK_SCHEMA } from "./types";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";

const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/shared/download", () => ({
  downloadBlob,
}));

import {
  exportPlaybooks,
  importPlaybooksFromText,
  parsePlaybookBundle,
  serializePlaybookBundle,
  commitPlaybookImport,
} from "./transfer";

describe("parsePlaybookBundle", () => {
  it("round-trips books and accepts a bare playbook", () => {
    const book = newPlaybook("de_mirage", "Defaults");
    const json = serializePlaybookBundle([book], 100);
    expect(JSON.parse(json)).toMatchObject({
      schema: PLAYBOOK_SCHEMA,
      exportedAt: 100,
      playbooks: [expect.objectContaining({ key: book.key })],
    });
    expect(parsePlaybookBundle(JSON.parse(json))?.playbooks).toHaveLength(1);
    expect(parsePlaybookBundle(book)?.playbooks).toEqual([book]);
    expect(parsePlaybookBundle(null)).toBeNull();
    expect(parsePlaybookBundle({ schema: 1, playbooks: [book] })?.playbooks[0]?.schema).toBe(
      PLAYBOOK_SCHEMA,
    );
    expect(parsePlaybookBundle({ schema: 0, playbooks: [book] })).toBeNull();
    expect(parsePlaybookBundle({ schema: PLAYBOOK_SCHEMA, playbooks: [{}] })).toBeNull();
    expect(
      parsePlaybookBundle({ schema: PLAYBOOK_SCHEMA, playbooks: [book], exportedAt: "x" }),
    ).toMatchObject({
      exportedAt: 0,
    });
  });
});

describe("exportPlaybooks / importPlaybooksFromText", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    downloadBlob.mockReset();
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
  });

  it("refuses to export an empty store", async () => {
    expect(await exportPlaybooks()).toEqual({
      ok: false,
      message: "No playbooks in this browser yet.",
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("downloads every saved book", async () => {
    await createPlaybook("de_mirage", "Defaults");
    const result = await exportPlaybooks();
    expect(result.ok).toBe(true);
    expect(downloadBlob).toHaveBeenCalledWith(
      PLAYBOOK_EXPORT_FILE,
      "application/json",
      expect.stringContaining("Defaults"),
    );
  });

  it("imports a bundle and a broken payload", async () => {
    expect(await importPlaybooksFromText("{")).toEqual({
      ok: false,
      message: "Playbook file is not valid JSON.",
    });
    expect(await importPlaybooksFromText("{}")).toEqual({
      ok: false,
      message: "Playbook file has no valid books.",
    });
    const book = newPlaybook("de_inferno", "A execs");
    const result = await importPlaybooksFromText(serializePlaybookBundle([book]));
    expect(result).toEqual({ ok: true, message: "Imported 1 playbook." });
    expect((await loadPlaybook(book.key))?.title).toBe("A execs");
    expect(await loadAllPlaybooks()).toHaveLength(1);
  });

  it("reports a plural import", async () => {
    const books = [newPlaybook("de_mirage", "A"), newPlaybook("de_mirage", "B")];
    expect(await importPlaybooksFromText(serializePlaybookBundle(books))).toEqual({
      ok: true,
      message: "Imported 2 playbooks.",
    });
  });

  it("exports several books and surfaces store failures", async () => {
    await createPlaybook("de_mirage", "A");
    await createPlaybook("de_inferno", "B");
    expect(await exportPlaybooks()).toEqual({
      ok: true,
      message: "Exported 2 playbooks.",
    });
    vi.spyOn(playbookStore, "loadAllPlaybooks").mockRejectedValueOnce(new Error("idb"));
    expect(await exportPlaybooks()).toEqual({
      ok: false,
      message: "Could not export playbooks.",
    });
    vi.mocked(playbookStore.loadAllPlaybooks).mockRestore();
    vi.spyOn(playbookStore, "savePlaybook").mockRejectedValueOnce(new Error("idb"));
    expect(
      await importPlaybooksFromText(serializePlaybookBundle([newPlaybook("de_nuke", "C")])),
    ).toEqual({
      ok: false,
      message: "Could not import playbooks.",
    });
    vi.mocked(playbookStore.savePlaybook).mockRestore();
  });

  it("uses quota copy when import cannot write", async () => {
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    vi.spyOn(playbookStore, "savePlaybook").mockRejectedValueOnce(quota);
    expect(
      await importPlaybooksFromText(serializePlaybookBundle([newPlaybook("de_nuke", "C")])),
    ).toEqual({
      ok: false,
      message: IDB_QUOTA_MESSAGE,
    });
    vi.mocked(playbookStore.savePlaybook).mockRestore();
  });

  it("asks what to do when a book with the same name already exists", async () => {
    const mine = await createPlaybook("de_mirage", "X");
    const incoming = { ...newPlaybook("de_mirage", "X"), pages: mine.pages };
    const result = await importPlaybooksFromText(serializePlaybookBundle([incoming]));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected conflicts");
    expect(result.conflicts).toHaveLength(1);
    expect(result.bundle).toBeDefined();
    const saved = await commitPlaybookImport(result.bundle!, {
      [incoming.key]: { action: "rename", title: "X (imported)" },
    });
    expect(saved).toEqual({ ok: true, message: "Imported 1 playbook." });
    const titles = (await loadAllPlaybooks()).map((book) => book.title).sort();
    expect(titles).toEqual(["X", "X (imported)"]);
  });

  it("round-trips local image bytes in the JSON bundle", async () => {
    const blob = new Blob([new Uint8Array([9, 8, 7])], { type: "image/png" });
    let book = newPlaybook("de_mirage", "Stills");
    const pageId = book.pages[0]!.id;
    book = setPageImages(book, pageId, [
      {
        id: "img-1",
        name: "lineup.png",
        mime: "image/png",
        x: 10,
        y: 20,
      },
    ]);
    await playbookStore.savePlaybook(book);
    await putPlaybookImageBlob("img-1", blob);

    const exported = await exportPlaybooks();
    expect(exported.ok).toBe(true);
    const json = downloadBlob.mock.calls.at(-1)?.[2] as string;
    const parsed = JSON.parse(json) as { images?: Record<string, string> };
    expect(parsed.images?.["img-1"]).toMatch(/^data:image\/png;base64,/);

    await deleteAllPlaybooks();
    expect(await getPlaybookImageBlob("img-1")).toBeNull();

    const result = await importPlaybooksFromText(json);
    expect(result).toEqual({ ok: true, message: "Imported 1 playbook." });
    const loaded = await loadPlaybook(book.key);
    expect(loaded?.pages[0]?.images[0]).toMatchObject({
      id: "img-1",
      name: "lineup.png",
      mime: "image/png",
      x: 10,
      y: 20,
    });
    const restored = await getPlaybookImageBlob("img-1");
    expect(restored).toBeTruthy();
    expect(new Uint8Array(await restored!.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });
});
