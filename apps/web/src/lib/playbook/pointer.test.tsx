import { useRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Drawing, NadeStyle } from "@/lib/notes/types";
import { defaultPlaybookColor } from "./pages";
import { createPlaybookView, usePlaybookPointer } from "./pointer";
import type { PlaybookTool } from "./pieces";
import type { NadeTrailDraft } from "./nadeTrail";
import type { PlaybookImage, PlaybookYouTube } from "./types";
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
  const gizmoRef = useRef<string | null>(null);
  const nadeTrailOnRef = useRef(false);
  const nadeStyleRef = useRef<NadeStyle>("icon");
  const nadeTrailRef = useRef<NadeTrailDraft | null>(null);
  const videosRef = useRef<readonly PlaybookYouTube[]>([]);
  const imagesRef = useRef<readonly PlaybookImage[]>([]);
  const openImageIdRef = useRef<string | null>(null);
  usePlaybookPointer({
    wrapRef,
    view,
    calRef,
    toolRef,
    noteRef,
    colorRef,
    draftRef,
    canvasRef,
    gizmoRef,
    nadeTrailOnRef,
    nadeStyleRef,
    nadeTrailRef,
    videosRef,
    imagesRef,
    openImageIdRef,
  });
  return null;
}

describe("usePlaybookPointer", () => {
  it("no-ops until the wrap is mounted", () => {
    const { unmount } = render(<EmptyWrap />);
    expect(true).toBe(true);
    unmount();
  });
});
