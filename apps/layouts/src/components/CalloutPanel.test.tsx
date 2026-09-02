import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyLayout, formatLayout } from "@/lib/layout";
import { poly } from "@/lib/testing/callouts";
import { CalloutPanel } from "./CalloutPanel";
import type { MapLayout } from "@/lib/types";

function layoutWith(callouts: MapLayout["callouts"], groups?: string[]): MapLayout {
  return { schema: 1, map: "de_mirage", callouts, ...(groups ? { groups } : {}) };
}

function props(overrides: Partial<Parameters<typeof CalloutPanel>[0]> = {}) {
  const layout = layoutWith([poly("a", "Palace"), poly("b", "Tetris")]);
  return {
    layout,
    selectedIds: ["a"],
    jsonText: formatLayout(layout),
    jsonError: null,
    dirty: true,
    saveNote: "Wrote path",
    onSelectedIds: vi.fn(),
    onCallouts: vi.fn(),
    onRename: vi.fn(),
    onRenameGroup: vi.fn(),
    onNudge: vi.fn(),
    onNudgeGroup: vi.fn(),
    onDelete: vi.fn(),
    onRemoveRegion: vi.fn(),
    onJsonText: vi.fn(),
    onApplyJson: vi.fn(),
    onSave: vi.fn(),
    onDownload: vi.fn(),
    onImportFile: vi.fn(),
    ...overrides,
  };
}

describe("CalloutPanel", () => {
  it("saves, downloads, and applies JSON", async () => {
    const p = props();
    render(<CalloutPanel {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Save to folder" }));
    expect(p.onSave).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(p.onDownload).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(p.onApplyJson).toHaveBeenCalled();
    expect(screen.getByText("Wrote path")).toBeInTheDocument();
    expect(screen.getByText(/Unsaved/)).toBeInTheDocument();
  });

  it("renames, nudges, and deletes the selected callout", async () => {
    const p = props();
    render(<CalloutPanel {...p} />);
    await userEvent.type(screen.getByDisplayValue("Palace"), "x");
    expect(p.onRename).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "↓" }));
    expect(p.onNudge).toHaveBeenCalledWith("a", 1);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onDelete).toHaveBeenCalledWith(["a"]);
  });

  it("groups two selected callouts and lists regions", async () => {
    const layout = layoutWith([
      {
        id: "apps",
        name: "Apps",
        floor: "default",
        regions: [
          {
            kind: "polygon",
            points: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 4 },
            ],
          },
          { kind: "circle", x: 80, y: 80, radius: 10 },
        ],
      },
      poly("b", "B Site"),
    ]);
    const p = props({ layout, selectedIds: ["b", "apps"] });
    render(<CalloutPanel {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(p.onCallouts).toHaveBeenCalled();
    expect(screen.getByText("Polygon (3)")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(p.onRemoveRegion).toHaveBeenCalledWith("apps", 0);
  });

  it("imports a json file", async () => {
    const p = props({ selectedIds: [] });
    const { container } = render(<CalloutPanel {...p} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["{}"], "de_mirage.json", { type: "application/json" });
    await userEvent.upload(input, file);
    expect(p.onImportFile).toHaveBeenCalled();
  });

  it("toggles selection from the list", async () => {
    const p = props({ selectedIds: [] });
    render(<CalloutPanel {...p} />);
    await userEvent.click(screen.getByText("Palace"));
    expect(p.onSelectedIds).toHaveBeenCalledWith(["a"]);
    await userEvent.click(screen.getByLabelText("Select Palace"));
    expect(p.onSelectedIds).toHaveBeenCalled();
  });

  it("shows the empty drawing hint", () => {
    render(<CalloutPanel {...props({ layout: emptyLayout("de_mirage"), selectedIds: [] })} />);
    expect(screen.getByText(/Polygon: click vertices/)).toBeInTheDocument();
  });

  it("groups, folds, and nudges a named cluster", async () => {
    const layout = layoutWith(
      [
        poly("a", "Palace", { group: "A side" }),
        poly("b", "Tetris", { group: "A side" }),
        poly("c", "Apps", { group: "B side" }),
        poly("d", "B Site", { group: "B side" }),
      ],
      ["A side", "B side"],
    );
    const p = props({ layout, selectedIds: ["a", "b"] });
    render(<CalloutPanel {...p} />);
    expect(screen.queryByText("Palace")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Show group members" })[0]!);
    expect(screen.getByText("Palace")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide group members" }));
    expect(screen.queryByText("Palace")).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Select A side"));
    expect(p.onSelectedIds).toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Show group members" })[0]!);
    fireEvent.click(screen.getByText("Tetris"), { metaKey: true });
    await userEvent.click(screen.getByRole("button", { name: "Move A side down" }));
    expect(p.onNudgeGroup).toHaveBeenCalledWith("A side", 1);
    await userEvent.click(screen.getByRole("button", { name: "Move B side up" }));
    expect(p.onNudgeGroup).toHaveBeenCalledWith("B side", -1);
    await userEvent.click(screen.getByRole("button", { name: "Ungroup" }));
    expect(p.onCallouts).toHaveBeenCalled();
  });

  it("ctrl-clicks to toggle a row", async () => {
    const p = props({ selectedIds: ["a"] });
    render(<CalloutPanel {...p} />);
    fireEvent.click(screen.getByText("Tetris"), { ctrlKey: true });
    expect(p.onSelectedIds).toHaveBeenCalled();
  });

  it("drags callouts onto group slots", () => {
    const layout = layoutWith(
      [
        poly("a", "Palace", { group: "A side" }),
        poly("b", "Tetris", { group: "A side" }),
        poly("c", "Mid"),
      ],
      ["A side"],
    );
    const p = props({ layout, selectedIds: ["c"] });
    render(<CalloutPanel {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Show group members" }));
    const row = screen.getByText("Mid").closest("li") as HTMLElement;
    const data: Record<string, string> = {};
    const dt = {
      effectAllowed: "all",
      dropEffect: "move",
      setData: (type: string, val: string) => {
        data[type] = val;
      },
      getData: (type: string) => data[type] ?? "",
    };
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.drag(row);
    const into = screen.getByText("A side").closest(".callout-cluster") as HTMLElement;
    fireEvent.dragOver(into, { dataTransfer: dt });
    fireEvent.drop(into, { dataTransfer: dt });
    expect(p.onCallouts).toHaveBeenCalled();
  });

  it("drags loose callouts onto the new-group and ungroup slots", () => {
    const p2 = props({
      layout: layoutWith([poly("a", "Palace"), poly("b", "Tetris")]),
      selectedIds: ["a", "b"],
    });
    render(<CalloutPanel {...p2} />);
    const data: Record<string, string> = {};
    const dt = {
      effectAllowed: "all",
      dropEffect: "move",
      setData: (type: string, val: string) => {
        data[type] = val;
      },
      getData: (type: string) => data[type] ?? "",
    };
    const palace = screen.getByText("Palace").closest("li") as HTMLElement;
    fireEvent.dragStart(palace, { dataTransfer: dt });
    fireEvent.drop(screen.getByText("Drop at bottom to make a new group"), { dataTransfer: dt });
    expect(p2.onCallouts).toHaveBeenCalled();
    fireEvent.drop(screen.getByText("Drop at top to ungroup"), { dataTransfer: dt });
  });

  it("selects a row with keyboard and skips a click after a drag", () => {
    const p = props();
    render(<CalloutPanel {...p} />);
    fireEvent.keyDown(screen.getByText("Tetris"), { key: "Enter" });
    expect(p.onSelectedIds).toHaveBeenCalledWith(["b"]);
    fireEvent.keyDown(screen.getByText("Tetris"), { key: " " });
    const row = screen.getByText("Palace").closest("li") as HTMLElement;
    const dt = {
      effectAllowed: "all",
      dropEffect: "move",
      setData: vi.fn(),
      getData: () => "",
    };
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.drag(row);
    fireEvent.dragEnd(row);
    fireEvent.click(screen.getByText("Palace"));
  });

  it("covers drop-slot hover, lower floors, group drag, and ignored controls", async () => {
    const layout = layoutWith(
      [
        poly("a", "Palace", { group: "A side", floor: "lower" }),
        poly("b", "Tetris", { group: "A side" }),
        poly("c", "Mid"),
      ],
      ["A side"],
    );
    const p = props({ layout, selectedIds: ["a"] });
    render(<CalloutPanel {...p} />);
    expect(screen.getByText(/Lower ·/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show group members" }));
    expect(screen.getByText("lower")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText("Mid"), { key: "x" });
    expect(p.onSelectedIds).not.toHaveBeenCalled();
    const data: Record<string, string> = {};
    const dt = {
      effectAllowed: "all",
      dropEffect: "move",
      setData: (type: string, val: string) => {
        data[type] = val;
      },
      getData: (type: string) => data[type] ?? "",
    };
    fireEvent.dragOver(screen.getByText("Drop at top to ungroup"), { dataTransfer: dt });
    fireEvent.dragOver(screen.getByText("Drop at bottom to make a new group"), {
      dataTransfer: dt,
    });
    const cluster = screen.getByText("A side").closest(".callout-cluster") as HTMLElement;
    fireEvent.pointerCancel(cluster);
    fireEvent.dragStart(cluster, { dataTransfer: dt });
    fireEvent.dragOver(cluster, { dataTransfer: dt });
    const head = cluster.querySelector(".callout-cluster-head") as HTMLElement;
    fireEvent.dragOver(head, { dataTransfer: dt });
    fireEvent.drop(head, { dataTransfer: dt });
    const mid = screen.getByText("Mid").closest("li") as HTMLElement;
    fireEvent.dragStart(mid, { dataTransfer: dt });
    fireEvent.dragOver(head, { dataTransfer: dt });
    fireEvent.drop(head, { dataTransfer: dt });
    fireEvent.drop(screen.getByText("Drop at top to ungroup"), {
      dataTransfer: { ...dt, getData: () => "not-json" },
    });
    fireEvent.pointerDown(screen.getByLabelText("Select Mid"));
    fireEvent.dragStart(mid, { dataTransfer: dt });
    await userEvent.click(screen.getByLabelText("Select A side"));
    expect(p.onSelectedIds).toHaveBeenCalled();
    expect(screen.getByText(/Lower/)).toBeInTheDocument();
  });
});
