import { TOOLBAR_PATHS, type ToolbarPathId } from "./toolbarPaths";

export function ToolbarIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ToolbarIconBtn({
  title,
  on,
  disabled,
  onClick,
  d,
  path,
}: {
  title: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  d?: string;
  path?: ToolbarPathId;
}) {
  const glyph = d ?? (path ? TOOLBAR_PATHS[path] : "");
  return (
    <button
      type="button"
      className={`icon-btn${on ? " on" : ""}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <ToolbarIcon d={glyph} />
    </button>
  );
}
