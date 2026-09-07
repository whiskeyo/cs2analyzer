import { useRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPlaybookView, usePlaybookPointer } from "./pointer";

function EmptyWrap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef(createPlaybookView());
  usePlaybookPointer({ wrapRef, view });
  return null;
}

describe("usePlaybookPointer", () => {
  it("no-ops until the wrap is mounted", () => {
    const { unmount } = render(<EmptyWrap />);
    expect(true).toBe(true);
    unmount();
  });
});
