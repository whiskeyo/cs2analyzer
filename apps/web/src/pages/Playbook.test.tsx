/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { deleteAllPlaybooks } from "@/lib/playbook/playbookStore";
import { Playbook } from "./Playbook";

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(),
  };
});

vi.mock("@/components/playbook/PlaybookCanvas", () => ({
  PlaybookCanvas: () => <div data-testid="playbook-canvas" />,
}));

import { loadCalibrations } from "@/lib/radar/maps";

describe("Playbook", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    vi.mocked(loadCalibrations).mockReset();
    vi.mocked(loadCalibrations).mockResolvedValue({
      de_inferno: UNIT_CALIBRATION,
      de_mirage: UNIT_CALIBRATION,
    });
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
  });

  it("picks a map, creates a book, and opens the board", async () => {
    render(<Playbook />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Map" })).toHaveValue("de_mirage"),
    );
    const map = screen.getByRole("combobox", { name: "Map" });
    await userEvent.selectOptions(map, "de_inferno");
    expect(map).toHaveValue("de_inferno");

    await userEvent.type(screen.getByRole("textbox", { name: "New playbook title" }), "A execs");
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Book title" })).toHaveValue("A execs");
    expect(screen.getByRole("button", { name: "A execs" })).toHaveClass("is-active");
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "Anti-strats" },
    });
    expect(screen.getByRole("textbox", { name: "Book title" })).toHaveValue("Anti-strats");
  });

  it("shows a load error when calibrations fail", async () => {
    vi.mocked(loadCalibrations).mockRejectedValue(new Error("maps down"));
    render(<Playbook />);
    expect(await screen.findByText("maps down")).toBeInTheDocument();
  });

  it("ignores a late calibrations result after unmount", async () => {
    let resolve: (value: Record<string, typeof UNIT_CALIBRATION>) => void = () => undefined;
    vi.mocked(loadCalibrations).mockImplementation(
      () =>
        new Promise((next) => {
          resolve = next;
        }),
    );
    const { unmount } = render(<Playbook />);
    unmount();
    resolve({ de_mirage: UNIT_CALIBRATION });
    await waitFor(() => expect(loadCalibrations).toHaveBeenCalled());
  });
});
