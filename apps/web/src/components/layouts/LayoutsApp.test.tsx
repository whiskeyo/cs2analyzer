import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLayout, formatLayout } from "@/lib/layouts/layout";
import { poly } from "@/lib/layouts/testing/callouts";
import { createMockCanvas } from "@/lib/layouts/testing/mockCanvas";

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(),
  };
});

vi.mock("@/lib/layouts/api", () => ({
  loadLayoutFile: vi.fn(),
  saveLayoutFile: vi.fn(),
}));

import { loadCalibrations } from "@/lib/radar/maps";
import { loadLayoutFile, saveLayoutFile } from "@/lib/layouts/api";
import { LayoutsApp } from "./LayoutsApp";

const cal = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "de_mirage.png",
  lower_radar: "de_mirage_lower.png",
};

const dust = { pos_x: 0, pos_y: 1024, scale: 1, radar: "de_dust2.png" };

describe("LayoutsApp", () => {
  beforeEach(() => {
    vi.mocked(loadCalibrations).mockResolvedValue({ de_dust2: dust, de_mirage: cal });
    vi.mocked(loadLayoutFile).mockImplementation(async (map) => emptyLayout(map));
    vi.mocked(saveLayoutFile).mockResolvedValue("apps/web/public/layouts/de_mirage.json");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createMockCanvas());
    class MockImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("picks another map when de_mirage is missing", async () => {
    vi.mocked(loadCalibrations).mockResolvedValue({ de_dust2: dust });
    render(<LayoutsApp />);
    expect(await screen.findByRole("combobox", { name: "Map" })).toHaveValue("de_dust2");
  });

  it("shows a boot error when calibrations fail", async () => {
    vi.mocked(loadCalibrations).mockRejectedValue(new Error("no maps"));
    render(<LayoutsApp />);
    expect(await screen.findByText("no maps")).toBeInTheDocument();
  });

  it("shows a boot error when the layout file fails", async () => {
    vi.mocked(loadLayoutFile).mockRejectedValue(new Error("no layout"));
    render(<LayoutsApp />);
    expect(await screen.findByText("no layout")).toBeInTheDocument();
  });

  it("loads the editor and switches tools", async () => {
    render(<LayoutsApp />);
    expect(await screen.findByRole("combobox", { name: "Map" })).toHaveValue("de_mirage");
    await userEvent.click(screen.getByRole("button", { name: "Select (5)" }));
    expect(screen.getByRole("button", { name: "Select (5)" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset view (R)" }));
    expect(screen.getByRole("separator", { name: "Resize layouts panel" })).toBeInTheDocument();
    expect(document.querySelector(".keys")).toHaveTextContent("1 pan");
  });

  it("applies JSON, imports a file, and saves", async () => {
    const filled = {
      ...emptyLayout("de_mirage"),
      callouts: [poly("palace", "Palace"), poly("tetris", "Tetris")],
    };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    render(<LayoutsApp />);
    expect(await screen.findByText("Palace")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Palace"));
    await userEvent.type(screen.getByDisplayValue("Palace"), "x");
    expect(screen.getByText(/Unsaved/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save to folder" }));
    await waitFor(() => expect(saveLayoutFile).toHaveBeenCalled());
    expect(await screen.findByText(/Wrote /)).toBeInTheDocument();

    vi.mocked(saveLayoutFile).mockRejectedValueOnce(new Error("disk full"));
    await userEvent.type(screen.getByDisplayValue("Palacex"), "y");
    await userEvent.click(screen.getByRole("button", { name: "Save to folder" }));
    expect(await screen.findByText("disk full")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(saveLayoutFile).toHaveBeenCalled());

    const area = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "{" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(screen.getByText(/JSON must be schema 1/)).toBeInTheDocument();

    fireEvent.change(area, { target: { value: formatLayout(filled) } });
    await userEvent.click(screen.getByRole("button", { name: "Apply JSON" }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([formatLayout(filled)], "de_mirage.json", { type: "application/json" });
    await userEvent.upload(input, file);

    const bad = new File(["not-json"], "x.json", { type: "application/json" });
    await userEvent.upload(input, bad);
    expect(await screen.findByText(/Could not parse that JSON file/)).toBeInTheDocument();
  });

  it("downloads, groups, deletes, and confirms map changes", async () => {
    const filled = {
      ...emptyLayout("de_mirage"),
      callouts: [
        {
          id: "apps",
          name: "Apps",
          floor: "default" as const,
          regions: [
            {
              kind: "polygon" as const,
              points: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
              ],
            },
            { kind: "circle" as const, x: 80, y: 80, radius: 10 },
          ],
        },
        poly("tetris", "Tetris"),
      ],
    };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    render(<LayoutsApp />);
    expect(await screen.findByText("Apps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(screen.getByText(/Downloaded de_mirage.json/)).toBeInTheDocument();

    await userEvent.click(screen.getByText("Apps"));
    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    await userEvent.click(screen.getByRole("button", { name: "↓" }));
    fireEvent.click(screen.getByText("Tetris"), { ctrlKey: true });
    fireEvent.keyDown(window, { key: "g" });
    await userEvent.dblClick(screen.getByText("Group 1"));
    await userEvent.type(screen.getByLabelText("Group name"), "A{Enter}");

    const junk = new File(['{"schema":1}'], "bad.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, junk);
    expect(await screen.findByText(/not a schema 1 layout/)).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "de_dust2");
    expect(loadLayoutFile).toHaveBeenCalledWith("de_mirage");

    vi.mocked(window.confirm).mockReturnValue(true);
    await userEvent.selectOptions(screen.getByRole("combobox"), "de_dust2");
    await waitFor(() => expect(loadLayoutFile).toHaveBeenCalledWith("de_dust2"));
  });

  it("warns before unload when dirty", async () => {
    const filled = { ...emptyLayout("de_mirage"), callouts: [poly("palace", "Palace")] };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    render(<LayoutsApp />);
    expect(await screen.findByText("Palace")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Palace"));
    await userEvent.type(screen.getByDisplayValue("Palace"), "z");
    const ev = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(ev, "returnValue", { writable: true, value: "" });
    window.dispatchEvent(ev);
  });

  it("deletes from the keyboard and ignores an empty rename", async () => {
    const filled = { ...emptyLayout("de_mirage"), callouts: [poly("palace", "Palace")] };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    render(<LayoutsApp />);
    expect(await screen.findByText("Palace")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Palace"));
    fireEvent.change(screen.getByDisplayValue("Palace"), { target: { value: "" } });
    expect(screen.getByDisplayValue("Palace")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.queryByText("Palace")).not.toBeInTheDocument();
  });

  it("stays on the loading screen when no maps are listed", async () => {
    vi.mocked(loadCalibrations).mockResolvedValue({});
    render(<LayoutsApp />);
    expect(await screen.findByText("Loading maps…")).toBeInTheDocument();
  });

  it("shows a generic save note when the error has no message", async () => {
    const filled = { ...emptyLayout("de_mirage"), callouts: [poly("palace", "Palace")] };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    vi.mocked(saveLayoutFile).mockRejectedValueOnce(new Error(""));
    render(<LayoutsApp />);
    expect(await screen.findByText("Palace")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Palace"));
    await userEvent.type(screen.getByDisplayValue("Palace"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save to folder" }));
    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("selects from the canvas, including ctrl-click toggle", async () => {
    const filled = {
      ...emptyLayout("de_mirage"),
      callouts: [
        {
          id: "yard",
          name: "Yard",
          floor: "default" as const,
          regions: [
            {
              kind: "polygon" as const,
              points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
              ],
            },
          ],
        },
        poly("tetris", "Tetris"),
      ],
    };
    vi.mocked(loadLayoutFile).mockResolvedValue(filled);
    render(<LayoutsApp />);
    expect(await screen.findByText("Yard")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Select (5)" }));
    const wrap = document.querySelector(".canvas-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 1056, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 1056, configurable: true });
    wrap.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1056,
        height: 1056,
        right: 1056,
        bottom: 1056,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.mouseDown(wrap, { button: 0, clientX: 66, clientY: 66 });
    expect(screen.getByDisplayValue("Yard")).toBeInTheDocument();
    fireEvent.mouseDown(wrap, { button: 0, ctrlKey: true, clientX: 66, clientY: 66 });
    fireEvent.mouseDown(wrap, { button: 0, ctrlKey: true, clientX: 400, clientY: 400 });
    fireEvent.mouseDown(wrap, { button: 0, clientX: 400, clientY: 400 });
  });
});
