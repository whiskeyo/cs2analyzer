import type { MouseEvent as ReactMouseEvent } from "react";

/** Keep keyboard focus on the page so global hotkeys own Space and brackets. */
export function blockTransportFocus(e: ReactMouseEvent) {
  e.preventDefault();
}
