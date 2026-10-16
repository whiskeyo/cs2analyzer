import { useId, useLayoutEffect, useState, type CSSProperties } from "react";
import type { Replay } from "@/lib/replay/replayTypes";
import { StatsTimeline } from "@/components/stats/StatsTimeline";
import { useMessages } from "@/lib/i18n/messages";
import { HomeModal } from "./HomeModal";

/** Viewport box of the radar column, so the dialog covers the map and not the sidebar. */
function mapColumnFrame(): CSSProperties | undefined {
  const column = document.querySelector(".map-column");
  if (!(column instanceof HTMLElement)) return undefined;
  const rect = column.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: "auto",
    bottom: "auto",
    padding: 0,
  };
}

function useMapColumnFrame(): CSSProperties | undefined {
  const [frame, setFrame] = useState<CSSProperties | undefined>(mapColumnFrame);
  useLayoutEffect(() => {
    const column = document.querySelector(".map-column");
    const measure = () => setFrame(mapColumnFrame());
    measure();
    const observer =
      typeof ResizeObserver !== "undefined" && column instanceof HTMLElement
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(column as HTMLElement);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return frame;
}

/** Stats timeline in the same dialog shell as Preferences, anchored over the map. */
export function StatsTimelineModal({
  replay,
  selected,
  onSelect,
  onClose,
}: {
  replay: Replay;
  selected: number | null;
  onSelect: (player: number | null) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const frame = useMapColumnFrame();
  const messages = useMessages();
  return (
    <HomeModal
      titleId={titleId}
      title={messages.timeline.open}
      onClose={onClose}
      backdropClassName={[
        "settings-modal",
        "stats-timeline-modal",
        frame ? "stats-timeline-modal-framed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      backdropStyle={frame}
      cardClassName="settings-modal-card stats-timeline-modal-card"
    >
      <StatsTimeline replay={replay} selected={selected} onSelect={onSelect} hideTitle />
    </HomeModal>
  );
}
