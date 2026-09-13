/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybookPdfExportDialog } from "./PlaybookPdfExportDialog";

describe("PlaybookPdfExportDialog", () => {
  it("offers with and without photos and remembers the last choice as pressed", async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(
      <PlaybookPdfExportDialog
        bookTitle="A execs"
        current="with"
        busy={false}
        onChoose={onChoose}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Export PDF" })).toBeInTheDocument();
    expect(screen.getByText(/A execs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With photos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Without photos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await userEvent.click(screen.getByRole("button", { name: "Without photos" }));
    expect(onChoose).toHaveBeenCalledWith("without");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
