/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOK_FOCUS_KEY } from "@/lib/playbook/focus";
import * as playbookStore from "@/lib/playbook/playbookStore";
import * as snapshot from "@/lib/playbook/snapshot";
import { rememberRecentPlaybook } from "@/lib/playbook/snapshotRecent";
import { SNAPSHOT_RECENT_BOOKS_KEY } from "@/lib/shared/storageKeys";
import { UNTITLED_PLAYBOOK } from "@/lib/playbook/types";
import { SnapshotDialog } from "./SnapshotDialog";

const DEFAULT_TITLE = "NaVi - FaZe (faceit.dem) · R12 0:00";

function renderDialog(extra: Partial<ComponentProps<typeof SnapshotDialog>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <SnapshotDialog
      mapName="de_anubis"
      pieces={[]}
      stratTitle={DEFAULT_TITLE}
      floor="auto"
      onClose={onClose}
      onSaved={onSaved}
      {...extra}
    />,
  );
  return { onClose, onSaved };
}

describe("SnapshotDialog", () => {
  beforeEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    localStorage.removeItem(SNAPSHOT_RECENT_BOOKS_KEY);
  });

  afterEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    localStorage.removeItem(SNAPSHOT_RECENT_BOOKS_KEY);
  });

  it("saves into an existing book and reports where it landed", async () => {
    await playbookStore.createPlaybook("de_anubis", "A execs");
    const { onClose, onSaved } = renderDialog();
    expect(await screen.findByRole("radio", { name: "A execs" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue(DEFAULT_TITLE);
    expect(screen.getByRole("checkbox", { name: "Pawns" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Util" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Kills" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Drawings" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        mapName: "de_anubis",
        bookTitle: "A execs",
        stratTitle: DEFAULT_TITLE,
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null")).toMatchObject({
      mapName: "de_anubis",
    });
  });

  it("creates a new playbook when chosen", async () => {
    await playbookStore.createPlaybook("de_anubis", "Old");
    const { onClose, onSaved } = renderDialog();
    await screen.findByRole("radio", { name: "Old" });
    await userEvent.click(screen.getByRole("radio", { name: "New playbook" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New playbook title" }), "Fresh");
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ bookTitle: "Fresh" })),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("lets the user pick another book and rename the strat", async () => {
    await playbookStore.createPlaybook("de_anubis", "Older");
    await playbookStore.createPlaybook("de_anubis", "Newer");
    const { onSaved } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    const older = screen.getByRole("radio", { name: "Older" });
    await userEvent.click(older);
    await waitFor(() => expect(older).toBeChecked());
    fireEvent.change(screen.getByRole("textbox", { name: "Strat name" }), {
      target: { value: "Custom strat" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ bookTitle: "Older" }));
    const saved = await playbookStore.loadPlaybook(
      JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null").bookKey,
    );
    expect(saved?.pages.some((page) => page.title === "Custom strat")).toBe(true);
  });

  it("lists recent books first and defaults to the last used one", async () => {
    const older = await playbookStore.createPlaybook("de_anubis", "Older");
    await playbookStore.createPlaybook("de_anubis", "Newer");
    rememberRecentPlaybook(older.key);
    renderDialog();
    expect(await screen.findByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Older" })).toBeChecked();
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAccessibleName("Older");
    expect(radios[1]).toHaveAccessibleName("Newer");
  });

  it("shows an error when the playbook list fails", async () => {
    vi.spyOn(playbookStore, "listPlaybooksForMap").mockRejectedValueOnce(new Error("idb down"));
    renderDialog();
    expect(await screen.findByText("idb down")).toBeInTheDocument();
    vi.mocked(playbookStore.listPlaybooksForMap).mockRestore();
  });

  it("shows an error when snapshot write fails", async () => {
    vi.spyOn(snapshot, "writeSnapshot").mockRejectedValueOnce(new Error("write failed"));
    const { onClose, onSaved } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByText("write failed")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    vi.mocked(snapshot.writeSnapshot).mockRestore();
  });

  it("stamps only the layers that stay checked", async () => {
    const write = vi.spyOn(snapshot, "writeSnapshot").mockResolvedValue({
      book: {
        schema: 4,
        key: "book-1",
        mapName: "de_anubis",
        title: "A execs",
        savedAt: 1,
        sort: 0,
        pages: [],
        activePageId: "p1",
        paletteId: "day",
        color: "#fff",
      },
      pageId: "p1",
    });
    const pawn = {
      id: "pawn-1",
      kind: "pawn" as const,
      x: 1,
      y: 2,
      groupId: "g1",
    };
    const smoke = { id: "util-1", kind: "smoke" as const, x: 3, y: 4 };
    const drawing = {
      type: "pen" as const,
      color: "#fff",
      points: [{ x: 0, y: 0 }],
    };
    const { onSaved } = renderDialog({
      pieces: [pawn, smoke],
      groups: [{ id: "g1", name: "Alice", drawings: [] }],
      drawings: [drawing],
      radarFx: {
        deaths: [{ x: 1, y: 2, line: null }],
        opening: null,
        tracers: [],
        trails: [{ points: [{ x: 0, y: 0 }], color: "#0f0", groupId: "g1" }],
        heatmap: [],
        summary: [],
        cone: null,
        hits: [],
        flashes: [],
      },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    await userEvent.click(screen.getByRole("checkbox", { name: "Pawns" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Kills" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Drawings" }));
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      pieces: [smoke],
      drawings: undefined,
      radarFx: undefined,
    });
    expect(onSaved).toHaveBeenCalled();
    write.mockRestore();
  });

  it("disables snapshot when every layer is off", async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    for (const name of ["Pawns", "Util", "Kills", "Drawings"]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }
    expect(screen.getByRole("button", { name: "Snapshot" })).toBeDisabled();
  });

  it("closes from cancel", async () => {
    const { onClose } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the untitled fallback when no books exist", async () => {
    renderDialog();
    expect(await screen.findByRole("radio", { name: "New playbook" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "New playbook title" })).toHaveAttribute(
      "placeholder",
      UNTITLED_PLAYBOOK,
    );
  });

  it("ignores a late book list after unmount", async () => {
    let resolve: (
      value: Awaited<ReturnType<typeof playbookStore.listPlaybooksForMap>>,
    ) => void = () => undefined;
    vi.spyOn(playbookStore, "listPlaybooksForMap").mockImplementation(
      () =>
        new Promise((next) => {
          resolve = next;
        }),
    );
    const { unmount } = render(
      <SnapshotDialog
        mapName="de_anubis"
        pieces={[]}
        stratTitle={DEFAULT_TITLE}
        floor="auto"
        onClose={() => undefined}
      />,
    );
    unmount();
    resolve([]);
    vi.mocked(playbookStore.listPlaybooksForMap).mockRestore();
  });
});
