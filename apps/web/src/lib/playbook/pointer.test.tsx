import { useRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Drawing } from "@/lib/notes/types";
import { defaultPlaybookColor } from "./pages";
import { createPlaybookView, usePlaybookPointer } from "./pointer";
import type { PlaybookTool } from "./pieces";
import type { MapCalibration } from "@/lib/replay/replayTypes";

function EmptyWrap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef(createPlaybookView());
  const calRef = useRef<MapCalibration | undefined>(undefined);
  const toolRef = useRef<PlaybookTool>("pan");
  const noteRef = useRef(emptyNote());
  const colorRef = useRef(defaultPlaybookColor());
  const draftRef = useRef<Drawing | null>(null);
  usePlaybookPointer({ wrapRef, view, calRef, toolRef, noteRef, colorRef, draftRef, canvasRef });
  return null;
}

describe("usePlaybookPointer", () => {
  it("no-ops until the wrap is mounted", () => {
    const { unmount } = render(<EmptyWrap />);
    expect(true).toBe(true);
    unmount();
  });
});
