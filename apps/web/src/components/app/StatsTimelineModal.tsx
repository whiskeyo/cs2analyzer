import { useId } from "react";
import type { Replay } from "@/lib/replay/replayTypes";
import { StatsTimeline } from "@/components/stats/StatsTimeline";
import { HomeModal } from "./HomeModal";

/** Stats timeline in the same dialog shell as Preferences. */
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
  return (
    <HomeModal
      titleId={titleId}
      onClose={onClose}
      backdropClassName="settings-modal stats-timeline-modal"
      cardClassName="settings-modal-card stats-timeline-modal-card"
    >
      <StatsTimeline replay={replay} selected={selected} onSelect={onSelect} headingId={titleId} />
    </HomeModal>
  );
}
