/**
 * @vitest-environment jsdom
 */
import { useId } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomeModal } from "./HomeModal";

function Dialog({ onClose, onEscape }: { onClose: () => void; onEscape?: () => void }) {
  const titleId = useId();
  return (
    <HomeModal
      titleId={titleId}
      onClose={onClose}
      onEscape={onEscape}
      backdropClassName="settings-modal"
    >
      <h2 id={titleId}>Preferences</h2>
      <button type="button">First</button>
      <button type="button">Last</button>
    </HomeModal>
  );
}

describe("HomeModal", () => {
  it("portals a labelled dialog and traps tab inside it", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Preferences" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.closest(".settings-modal")?.parentElement).toBe(document.body);
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveClass("home-modal-close");
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();

    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);

    fireEvent.pointerDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = dialog.parentElement;
    expect(backdrop).toBeInstanceOf(HTMLElement);
    if (backdrop instanceof HTMLElement) fireEvent.pointerDown(backdrop);
    expect(onClose).toHaveBeenCalledOnce();

    opener.remove();
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<Dialog onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
