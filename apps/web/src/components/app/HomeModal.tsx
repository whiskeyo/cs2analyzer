import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => !el.closest("[inert], [aria-hidden='true']"),
  );
}

/**
 * Settings dialog shell: portaled backdrop, labelled dialog, Escape, and a tab cycle
 * that stays inside the backdrop (including a confirm layered on the card).
 */
export function HomeModal({
  titleId,
  onClose,
  onEscape,
  backdropClassName,
  cardClassName,
  children,
  after,
}: {
  titleId: string;
  onClose: () => void;
  /** Defaults to `onClose`. Settings uses this to dismiss a confirm first. */
  onEscape?: () => void;
  backdropClassName?: string;
  cardClassName?: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape ?? onClose);
  onCloseRef.current = onClose;
  onEscapeRef.current = onEscape ?? onClose;

  useEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;
    const previously =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (tabbables(card)[0] ?? card).focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = tabbables(root);
      if (items.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && root.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previously?.isConnected) previously.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      className={["home-modal", backdropClassName].filter(Boolean).join(" ")}
      onPointerDown={(event) => {
        // Leftover `click` from unmounting the gear menu must not dismiss.
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={cardRef}
        className={["home-modal-card", cardClassName].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
      {after}
    </div>,
    document.body,
  );
}
