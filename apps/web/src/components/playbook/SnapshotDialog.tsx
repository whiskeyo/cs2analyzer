import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { playbookHref } from "@/lib/app/playbookSearch";
import { useMessages } from "@/lib/i18n/useMessages";
import type { DrawingGroup, FloorMode, NoteRadarFx, Piece } from "@/lib/notes/types";
import { rememberPlaybookFocus } from "@/lib/playbook/focus";
import { listPlaybooksForMap } from "@/lib/playbook/playbookStore";
import { writeSnapshot } from "@/lib/playbook/snapshot";
import type { Playbook } from "@/lib/playbook/types";
import { errorMessage } from "@/lib/validate/json.ts";

const NEW_BOOK = "new";

interface Props {
  mapName: string;
  pieces: Piece[];
  groups?: DrawingGroup[];
  radarFx?: NoteRadarFx;
  stratTitle: string;
  floor: FloorMode;
  onClose: () => void;
}

export function SnapshotDialog({
  mapName,
  pieces,
  groups,
  radarFx,
  stratTitle: initialTitle,
  floor,
  onClose,
}: Props) {
  const { messages, tNodes } = useMessages();
  const titleId = useId();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Playbook[] | null>(null);
  const [target, setTarget] = useState(NEW_BOOK);
  const [newTitle, setNewTitle] = useState("");
  const [stratTitle, setStratTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ title: string; key: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPlaybooksForMap(mapName)
      .then((list) => {
        if (cancelled) return;
        setBooks(list);
        setTarget(list[0]?.key ?? NEW_BOOK);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mapName]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { book } = await writeSnapshot({
        mapName,
        bookKey: target === NEW_BOOK ? null : target,
        newBookTitle: newTitle,
        stratTitle,
        pieces,
        radarFx,
        groups,
        floor,
      });
      // Playbook reads this once on mount (`consumePlaybookFocus`) after navigate.
      rememberPlaybookFocus({ mapName, bookKey: book.key });
      setSaved({ title: book.title, key: book.key });
    } catch (err: unknown) {
      setError(errorMessage(err) || messages.playbook.snapshotError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="home-modal" onClick={onClose}>
      <div
        className="home-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{messages.playbook.snapshotTitle}</h2>
        {saved ? (
          <>
            <p>
              {tNodes(messages.playbook.snapshotSaved, {
                title: <strong>{saved.title}</strong>,
              })}
            </p>
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={onClose}>
                {messages.preferences.close}
              </button>
              <button
                type="button"
                onClick={() => {
                  rememberPlaybookFocus({ mapName, bookKey: saved.key });
                  navigate(
                    playbookHref({
                      map: mapName,
                      playbook: saved.title,
                      strat: stratTitle,
                    }),
                  );
                  onClose();
                }}
              >
                {messages.playbook.snapshotOpen}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{messages.playbook.snapshotLead}</p>
            <fieldset className="snapshot-books">
              <legend>{messages.playbook.snapshotBook}</legend>
              {(books ?? []).map((book) => (
                <label key={book.key}>
                  <input
                    type="radio"
                    name="snapshot-book"
                    checked={target === book.key}
                    onChange={() => setTarget(book.key)}
                  />
                  {book.title}
                </label>
              ))}
              <label>
                <input
                  type="radio"
                  name="snapshot-book"
                  checked={target === NEW_BOOK}
                  onChange={() => setTarget(NEW_BOOK)}
                />
                {messages.playbook.snapshotNewBook}
              </label>
            </fieldset>
            {target === NEW_BOOK ? (
              <label className="playbook-field">
                {messages.playbook.snapshotNewTitle}
                <input
                  aria-label={messages.playbook.snapshotNewTitle}
                  value={newTitle}
                  placeholder={messages.playbook.untitledBook}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
            ) : null}
            <label className="playbook-field">
              {messages.playbook.fieldStratName}
              <input
                aria-label={messages.playbook.fieldStratName}
                value={stratTitle}
                onChange={(e) => setStratTitle(e.target.value)}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={onClose}>
                {messages.preferences.cancel}
              </button>
              <button type="button" disabled={saving || books == null} onClick={() => void save()}>
                {messages.playbook.snapshotSubmit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
