import { useEffect, useId, useState } from "react";
import { navigate, ROUTES } from "@/lib/app/devNavigate";
import type { FloorMode } from "@/lib/notes/types";
import { rememberPlaybookFocus } from "@/lib/playbook/focus";
import { listPlaybooksForMap } from "@/lib/playbook/playbookStore";
import { snapshotPieces, snapshotTitleFromReplay, writeSnapshot } from "@/lib/playbook/snapshot";
import { UNTITLED_PLAYBOOK, type Playbook } from "@/lib/playbook/types";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import { errorMessage } from "@/lib/validate/json.ts";

const NEW_BOOK = "new";

interface Props {
  mapName: string;
  replay: Replay;
  tick: number;
  fileName: string;
  floor: FloorMode;
  cal: MapCalibration | undefined;
  onClose: () => void;
}

export function SnapshotDialog({ mapName, replay, tick, fileName, floor, cal, onClose }: Props) {
  const titleId = useId();
  const [books, setBooks] = useState<Playbook[] | null>(null);
  const [target, setTarget] = useState(NEW_BOOK);
  const [newTitle, setNewTitle] = useState("");
  const [stratTitle, setStratTitle] = useState(() =>
    snapshotTitleFromReplay(replay, tick, fileName),
  );
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
        pieces: snapshotPieces(replay, tick, cal),
        floor,
      });
      rememberPlaybookFocus({ mapName, bookKey: book.key });
      setSaved({ title: book.title, key: book.key });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Snapshot failed");
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
        <h2 id={titleId}>Snapshot to playbook</h2>
        {saved ? (
          <>
            <p>
              Saved to <strong>{saved.title}</strong>.
            </p>
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  rememberPlaybookFocus({ mapName, bookKey: saved.key });
                  navigate(ROUTES.playbook);
                  onClose();
                }}
              >
                Open strat
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Pick a playbook for this map, then a new named strat. Drawings stay on Analyzer.</p>
            <fieldset className="snapshot-books">
              <legend>Playbook</legend>
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
                New playbook
              </label>
            </fieldset>
            {target === NEW_BOOK ? (
              <label className="playbook-field">
                New playbook title
                <input
                  aria-label="New playbook title"
                  value={newTitle}
                  placeholder={UNTITLED_PLAYBOOK}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
            ) : null}
            <label className="playbook-field">
              Strat name
              <input
                aria-label="Strat name"
                value={stratTitle}
                onChange={(e) => setStratTitle(e.target.value)}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" disabled={saving || books == null} onClick={() => void save()}>
                Snapshot
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
