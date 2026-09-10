/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playbookHref } from "@/lib/app/playbookSearch";
import { PLAYBOOK_FOCUS_KEY } from "@/lib/playbook/focus";
import { loadPlaybook } from "@/lib/playbook/playbookStore";
import * as playbookStore from "@/lib/playbook/playbookStore";
import { UNTITLED_PLAYBOOK, UNTITLED_STRAT } from "@/lib/playbook/types";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { TestRouter } from "@/lib/testing/router";
import { CreatePlaybookDialog } from "./CreatePlaybookDialog";

const navigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(async () => ({
      de_inferno: UNIT_CALIBRATION,
      de_mirage: UNIT_CALIBRATION,
    })),
  };
});

function renderDialog() {
  const onClose = vi.fn();
  render(
    <TestRouter>
      <CreatePlaybookDialog onClose={onClose} />
    </TestRouter>,
  );
  return onClose;
}

describe("CreatePlaybookDialog", () => {
  beforeEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    vi.mocked(navigate).mockReset();
  });

  afterEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
  });

  it("creates a playbook on the chosen map and opens the empty strat", async () => {
    const onClose = renderDialog();
    const map = await screen.findByRole("combobox", { name: "Map" });
    expect(map).toHaveValue("de_mirage");
    await userEvent.selectOptions(map, "de_inferno");
    await userEvent.type(screen.getByRole("textbox", { name: "Playbook title" }), "A execs");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const href = vi.mocked(navigate).mock.calls[0]?.[0] as string;
    expect(href).toBe(
      playbookHref({
        map: "de_inferno",
        playbook: "A execs",
        strat: UNTITLED_STRAT,
      }),
    );
    const focus = JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null") as {
      mapName: string;
      bookKey: string;
    };
    expect(focus.mapName).toBe("de_inferno");
    const book = await loadPlaybook(focus.bookKey);
    expect(book?.title).toBe("A execs");
    expect(book?.mapName).toBe("de_inferno");
    expect(book?.pages[0]?.title).toBe(UNTITLED_STRAT);
    expect(onClose).toHaveBeenCalled();
  });

  it("falls back to Untitled playbook when the title is left empty", async () => {
    renderDialog();
    await screen.findByRole("combobox", { name: "Map" });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith(
      playbookHref({
        map: "de_mirage",
        playbook: UNTITLED_PLAYBOOK,
        strat: UNTITLED_STRAT,
      }),
    );
  });

  it("closes on Cancel and Escape without creating", async () => {
    const onClose = renderDialog();
    await screen.findByRole("combobox", { name: "Map" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    onClose.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await playbookStore.loadAllPlaybooks()).toEqual([]);
  });
});
