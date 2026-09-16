/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { SERIES_MAX_FILES } from "@/lib/shared/constants";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { AddDemoControl } from "./AddDemoControl";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

const pickMocks = vi.hoisted(() => ({
  demoFilePickerAvailable: vi.fn(() => false),
  pickOpenFiles: vi.fn(),
}));

vi.mock("@/lib/notes/projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notes/projectStore")>();
  return {
    ...actual,
    demoFilePickerAvailable: pickMocks.demoFilePickerAvailable,
    pickOpenFiles: pickMocks.pickOpenFiles,
  };
});

function twoDemoSession() {
  const replay = makeReplay({ header: { map_name: "de_mirage" } });
  const a = loadedDemo(replay, "a.dem", new File([], "a.dem"));
  const b = loadedDemo(replay, "b.dem", new File([], "b.dem"));
  return {
    session: {
      demo: a,
      series: buildSeries("de_mirage", [a, b]),
      parsedDemos: [a, b],
      mapGroups: [{ mapName: "de_mirage", demos: [a, b] }],
      parsing: false,
    },
    appendFiles: vi.fn(),
  };
}

describe("AddDemoControl", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    pickMocks.demoFilePickerAvailable.mockReturnValue(false);
    pickMocks.pickOpenFiles.mockReset();
  });

  it("picks files through the hidden input when the OS picker is unavailable", async () => {
    const ctx = twoDemoSession();
    vi.mocked(useApp).mockReturnValue(ctx as unknown as ReturnType<typeof useApp>);
    render(<AddDemoControl />);
    const button = screen.getByRole("button", { name: "Add demo" });
    expect(button).toBeEnabled();
    const input = screen.getByLabelText("Add demo files") as HTMLInputElement;
    const file = new File(["x"], "extra.dem");
    await userEvent.upload(input, file);
    expect(ctx.appendFiles).toHaveBeenCalledWith([file]);
  });

  it("disables Add demo at the series cap", () => {
    const replay = makeReplay({ header: { map_name: "de_mirage" } });
    const demos = Array.from({ length: SERIES_MAX_FILES }, (_, i) =>
      loadedDemo(replay, `${i}.dem`, new File([], `${i}.dem`)),
    );
    vi.mocked(useApp).mockReturnValue({
      session: {
        demo: demos[0],
        series: buildSeries("de_mirage", demos),
        parsedDemos: demos,
        mapGroups: [{ mapName: "de_mirage", demos }],
        parsing: false,
      },
      appendFiles: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    render(<AddDemoControl />);
    const button = screen.getByRole("button", { name: "Add demo" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", `Series supports at most ${SERIES_MAX_FILES} demos.`);
  });

  it("uses the File System Access picker when it is available", async () => {
    const ctx = twoDemoSession();
    pickMocks.demoFilePickerAvailable.mockReturnValue(true);
    const file = new File(["x"], "picked.dem");
    pickMocks.pickOpenFiles.mockResolvedValue({ files: [file], handles: [] });
    vi.mocked(useApp).mockReturnValue(ctx as unknown as ReturnType<typeof useApp>);
    render(<AddDemoControl />);
    await userEvent.click(screen.getByRole("button", { name: "Add demo" }));
    expect(pickMocks.pickOpenFiles).toHaveBeenCalled();
    expect(ctx.appendFiles).toHaveBeenCalledWith([file]);
  });
});
