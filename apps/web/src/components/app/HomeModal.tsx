import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMessages } from "@/lib/i18n/messages";

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
  title,
  onClose,
  onEscape,
  backdropClassName,
  backdropStyle,
  cardClassName,
  children,
  after,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  /** Defaults to `onClose`. Settings uses this to dismiss a confirm first. */
  onEscape?: () => void;
  backdropClassName?: string;
  backdropStyle?: CSSProperties;
  cardClassName?: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const messages = useMessages();
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
      style={backdropStyle}
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
        <div className="home-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="home-modal-close"
            aria-label={messages.dialog.close}
            onClick={() => onCloseRef.current()}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M4 4 L12 12 M12 4 L4 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="home-modal-body">{children}</div>
      </div>
      {after}
    </div>,
    document.body,
  );
}
