import type { ReactNode } from "react";
import { blockTransportFocus } from "@/lib/playback/transportFocus";

interface Props {
  title?: string;
  className?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Toolbar control that never steals keyboard focus from global hotkeys. */
export function UnfocusableButton({
  title,
  className,
  ariaLabel,
  ariaPressed,
  onClick,
  children,
}: Props) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={className}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onMouseDown={blockTransportFocus}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
