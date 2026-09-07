/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigate, ROUTES } from "@/lib/app/devNavigate";
import { PLAYBOOK_FOCUS_KEY } from "@/lib/playbook/focus";
import * as playbookStore from "@/lib/playbook/playbookStore";
import * as snapshot from "@/lib/playbook/snapshot";
import { UNTITLED_PLAYBOOK } from "@/lib/playbook/types";
import { SnapshotDialog } from "./SnapshotDialog";

vi.mock("@/lib/app/devNavigate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/app/devNavigate")>();
  return { ...actual, navigate: vi.fn() };
});

const DEFAULT_TITLE = "NaVi - FaZe (faceit.dem) · R12 0:00";

function renderDialog() {
  const onClose = vi.fn();
  render(
    <SnapshotDialog
      mapName="de_anubis"
      pieces={[]}
      stratTitle={DEFAULT_TITLE}
      floor="auto"
      onClose={onClose}
    />,
  );
  return onClose;
}

describe("SnapshotDialog", () => {
  beforeEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    vi.mocked(navigate).mockReset();
  });

  afterEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
  });

  it("saves into an existing book and opens the strat", async () => {
    await playbookStore.createPlaybook("de_anubis", "A execs");
    const onClose = renderDialog();
    expect(await screen.findByRole("radio", { name: "A execs" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue(DEFAULT_TITLE);
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByText(/Saved to/)).toBeInTheDocument();
    expect(screen.getByText("A execs")).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null")).toMatchObject({
      mapName: "de_anubis",
    });
    await userEvent.click(screen.getByRole("button", { name: "Open strat" }));
    expect(navigate).toHaveBeenCalledWith(ROUTES.playbook);
    expect(onClose).toHaveBeenCalled();
  });

  it("creates a new playbook when chosen", async () => {
    await playbookStore.createPlaybook("de_anubis", "Old");
    const onClose = renderDialog();
    await screen.findByRole("radio", { name: "Old" });
    await userEvent.click(screen.getByRole("radio", { name: "New playbook" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New playbook title" }), "Fresh");
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByText("Fresh")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("lets the user pick another book and rename the strat", async () => {
    await playbookStore.createPlaybook("de_anubis", "Older");
    await playbookStore.createPlaybook("de_anubis", "Newer");
    renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    const older = screen.getByRole("radio", { name: "Older" });
    await userEvent.click(older);
    await waitFor(() => expect(older).toBeChecked());
    fireEvent.change(screen.getByRole("textbox", { name: "Strat name" }), {
      target: { value: "Custom strat" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByText(/Saved to/)).toBeInTheDocument();
    expect(screen.getByRole("strong")).toHaveTextContent("Older");
    const saved = await playbookStore.loadPlaybook(
      JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null").bookKey,
    );
    expect(saved?.pages.some((page) => page.title === "Custom strat")).toBe(true);
  });

  it("shows an error when the playbook list fails", async () => {
    vi.spyOn(playbookStore, "listPlaybooksForMap").mockRejectedValueOnce(new Error("idb down"));
    renderDialog();
    expect(await screen.findByText("idb down")).toBeInTheDocument();
    vi.mocked(playbookStore.listPlaybooksForMap).mockRestore();
  });

  it("shows an error when snapshot write fails", async () => {
    vi.spyOn(snapshot, "writeSnapshot").mockRejectedValueOnce(new Error("write failed"));
    renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByText("write failed")).toBeInTheDocument();
    vi.mocked(snapshot.writeSnapshot).mockRestore();
  });

  it("closes from cancel", async () => {
    const onClose = renderDialog();
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
