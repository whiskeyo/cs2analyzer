import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportNotesButton } from "./ImportNotesButton";
import { en } from "@/lib/i18n";
describe("ImportNotesButton", () => {
  it("opens the hidden file input when clicked", async () => {
    const onFile = vi.fn();
    const { container } = render(<ImportNotesButton onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("button", { name: en.settings.importNotes }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("forwards the chosen JSON file", async () => {
    const onFile = vi.fn();
    const { container } = render(<ImportNotesButton onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"version":1}'], "notes.json", { type: "application/json" });
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
