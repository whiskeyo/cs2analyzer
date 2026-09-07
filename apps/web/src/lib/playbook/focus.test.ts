/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { PLAYBOOK_FOCUS_KEY, consumePlaybookFocus, rememberPlaybookFocus } from "./focus";

afterEach(() => {
  sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
});

describe("playbook focus", () => {
  it("remembers a book and consumes it once", () => {
    rememberPlaybookFocus({ mapName: "de_inferno", bookKey: "book-1" });
    expect(consumePlaybookFocus()).toEqual({ mapName: "de_inferno", bookKey: "book-1" });
    expect(consumePlaybookFocus()).toBeNull();
  });

  it("drops malformed or empty payloads", () => {
    sessionStorage.setItem(PLAYBOOK_FOCUS_KEY, "{");
    expect(consumePlaybookFocus()).toBeNull();
    sessionStorage.setItem(PLAYBOOK_FOCUS_KEY, JSON.stringify({ mapName: "de_mirage" }));
    expect(consumePlaybookFocus()).toBeNull();
    sessionStorage.setItem(PLAYBOOK_FOCUS_KEY, JSON.stringify({ mapName: "  ", bookKey: "k" }));
    expect(consumePlaybookFocus()).toBeNull();
    sessionStorage.setItem(
      PLAYBOOK_FOCUS_KEY,
      JSON.stringify({ mapName: "de_mirage", bookKey: "  " }),
    );
    expect(consumePlaybookFocus()).toBeNull();
    sessionStorage.setItem(PLAYBOOK_FOCUS_KEY, "null");
    expect(consumePlaybookFocus()).toBeNull();
    expect(consumePlaybookFocus()).toBeNull();
  });

  it("no-ops when sessionStorage throws", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      rememberPlaybookFocus({ mapName: "de_mirage", bookKey: "k" });
      expect(consumePlaybookFocus()).toBeNull();
    } finally {
      if (desc) Object.defineProperty(window, "sessionStorage", desc);
    }
  });
});
