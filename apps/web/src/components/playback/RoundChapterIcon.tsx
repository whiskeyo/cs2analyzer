import type { ReactNode } from "react";
import { GearIcon, WeaponIcon } from "@/components/weapons/WeaponIcon";
import type { RoundChapter } from "@/lib/playback/roundChapter";

/**
 * Glyphs for `roundChapter`:
 * - pistol → Glock (the pistol-round icon)
 * - knife → knife
 * - eco → down arrow (low spend)
 * - force → bolt (partial buy)
 * - full → ascending bars (full buy)
 * - overtime → OT
 */
export function RoundChapterIcon({ chapter }: { chapter: RoundChapter }) {
  if (chapter === "pistol") {
    return <WeaponIcon weapon="glock" title="" className="round-chapter-icon" />;
  }
  if (chapter === "knife") {
    return <GearIcon name="knife" title="" className="round-chapter-icon" />;
  }
  if (chapter === "overtime") {
    return <span className="round-chapter-ot">OT</span>;
  }
  return <ChapterMark chapter={chapter} />;
}

function ChapterMark({ chapter }: { chapter: "eco" | "force" | "full" }) {
  return (
    <svg className={`round-chapter-icon ${chapter}`} viewBox="0 0 14 14" aria-hidden="true">
      {markPath(chapter)}
    </svg>
  );
}

function markPath(chapter: "eco" | "force" | "full"): ReactNode {
  if (chapter === "eco") {
    return (
      <path
        d="M7 2.2v6.2M3.6 6.2 7 10.4l3.4-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (chapter === "force") {
    return <path d="M8.1 1.4 3.6 7.4h3.1L5.8 12.6 10.6 6.2H7.4L8.1 1.4z" fill="currentColor" />;
  }
  return (
    <>
      <rect x="1.2" y="8" width="2.6" height="4.2" rx="0.4" fill="currentColor" />
      <rect x="5.7" y="5" width="2.6" height="7.2" rx="0.4" fill="currentColor" />
      <rect x="10.2" y="2" width="2.6" height="10.2" rx="0.4" fill="currentColor" />
    </>
  );
}
