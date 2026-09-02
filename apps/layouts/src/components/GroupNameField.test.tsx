import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupNameField } from "./GroupNameField";

describe("GroupNameField", () => {
  it("renames on Enter and cancels on Escape", async () => {
    const onRenameGroup = vi.fn();
    render(<GroupNameField groupId="A side" onRenameGroup={onRenameGroup} />);
    await userEvent.dblClick(screen.getByText("A side"));
    const input = screen.getByLabelText("Group name");
    await userEvent.clear(input);
    await userEvent.type(input, "A");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameGroup).toHaveBeenCalledWith("A side", "A");
  });

  it("restores the name on Escape and ignores a blank rename", async () => {
    const onRenameGroup = vi.fn();
    render(<GroupNameField groupId="g1" onRenameGroup={onRenameGroup} />);
    await userEvent.dblClick(screen.getByText("Group 1"));
    const input = screen.getByLabelText("Group name");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRenameGroup).not.toHaveBeenCalled();
    expect(screen.getByText("Group 1")).toBeInTheDocument();

    await userEvent.dblClick(screen.getByText("Group 1"));
    const again = screen.getByLabelText("Group name");
    await userEvent.clear(again);
    fireEvent.blur(again);
    expect(onRenameGroup).not.toHaveBeenCalled();
  });
});
