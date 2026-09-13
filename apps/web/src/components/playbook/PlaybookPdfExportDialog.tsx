import { useEffect, useId } from "react";
import type { PdfPhotos } from "@/lib/settings/userSettings";

interface Props {
  bookTitle: string;
  current: PdfPhotos;
  busy: boolean;
  onChoose: (photos: PdfPhotos) => void;
  onClose: () => void;
}

const CHOICES: { id: PdfPhotos; label: string; hint: string }[] = [
  { id: "with", label: "With photos", hint: "Embed lineup pictures under the still." },
  { id: "without", label: "Without photos", hint: "Radar stills and pins only — cheaper print." },
];

export function PlaybookPdfExportDialog({ bookTitle, current, busy, onChoose, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="home-modal" onClick={onClose}>
      <div
        className="home-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Export PDF</h2>
        <p>
          {bookTitle}. Radar stills and pins stay either way. Embedded photos make a larger print.
        </p>
        <div className="home-modal-actions playbook-pdf-export-actions">
          {CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={current === choice.id ? undefined : "ghost"}
              aria-pressed={current === choice.id}
              disabled={busy}
              title={choice.hint}
              onClick={() => onChoose(choice.id)}
            >
              {busy && current === choice.id ? "Exporting…" : choice.label}
            </button>
          ))}
          <button type="button" className="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
