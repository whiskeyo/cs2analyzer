/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImportConflict } from "@/lib/playbook/merge";
import { addPage, newPlaybook } from "@/lib/playbook/pages";
import { ImportMergeDialog } from "./ImportMergeDialog";

function twoUntitledConflict(): ImportConflict {
  let existing = newPlaybook("de_mirage", "Defaults");
  existing = addPage(existing, "Untitled strat");
  const incoming = structuredClone(existing);
  incoming.key = "incoming";
  incoming.pages[0]!.id = "in-a";
  incoming.pages[1]!.id = "in-b";
  incoming.pages[0]!.title = "Untitled strat";
  incoming.pages[1]!.title = "Untitled strat";
  return {
    incoming,
    existing,
    reason: "title",
    stratConflicts: [
      { pageId: "in-a", title: "Untitled strat" },
      { pageId: "in-b", title: "Untitled strat" },
    ],
  };
}

describe("ImportMergeDialog", () => {
  it("keeps duplicate strat titles on separate selects", () => {
    const onConfirm = vi.fn();
    render(
      <ImportMergeDialog
        conflicts={[twoUntitledConflict()]}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Merge strats into mine" }));
    const first = screen.getByRole("combobox", { name: "Strat Untitled strat (1)" });
    const second = screen.getByRole("combobox", { name: "Strat Untitled strat (2)" });
    fireEvent.change(first, { target: { value: "replace" } });
    fireEvent.change(second, { target: { value: "skip" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(onConfirm).toHaveBeenCalledWith({
      incoming: expect.objectContaining({
        action: "merge",
        strats: { "in-a": "replace", "in-b": "skip" },
      }),
    });
  });
});
