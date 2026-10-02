import { publicUrl } from "@/lib/shared/publicUrl";

/** Play triangle inside a film frame — export the whole round. */
export function ClipRecordIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="1.5"
        y="3"
        width="13"
        height="10"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M3.2 5.2v1.1M3.2 9.7v1.1M12.8 5.2v1.1M12.8 9.7v1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M6.3 5.6 10.7 8 6.3 10.4V5.6z" fill="currentColor" />
    </svg>
  );
}

/** Same record mark with the bomb silhouette, for a post-plant clip. */
export function ClipFromPlantIcon() {
  return (
    <span className="clip-record-icon">
      <ClipRecordIcon />
      <img src={publicUrl("weapons/c4.svg")} alt="" className="clip-record-c4" />
    </span>
  );
}

/** Dismiss an in-progress clip export. */
export function ClipCancelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
