import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { playbookHref } from "@/lib/app/playbookSearch";
import type {
  Drawing,
  DrawingGroup,
  FloorMode,
  NoteRadarFx,
  Piece,
} from "@/lib/notes/types";
import { rememberPlaybookFocus } from "@/lib/playbook/focus";
import { listPlaybooksForMap } from "@/lib/playbook/playbookStore";
import { writeSnapshot } from "@/lib/playbook/snapshot";
import {
  applySnapshotLayers,
  DEFAULT_SNAPSHOT_LAYERS,
  SNAPSHOT_LAYER_OPTIONS,
  snapshotLayerSelected,
  type SnapshotLayers,
} from "@/lib/playbook/snapshotLayers";
import { UNTITLED_PLAYBOOK, type Playbook } from "@/lib/playbook/types";
import { errorMessage } from "@/lib/validate/json.ts";

const NEW_BOOK = "new";

interface Props {
  mapName: string;
  pieces: Piece[];
  groups?: DrawingGroup[];
  drawings?: Drawing[];
  radarFx?: NoteRadarFx;
  stratTitle: string;
  floor: FloorMode;
  onClose: () => void;
}

export function SnapshotDialog({
  mapName,
  pieces,
  groups,
  drawings,
  radarFx,
  stratTitle: initialTitle,
  floor,
  onClose,
}: Props) {
  const titleId = useId();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Playbook[] | null>(null);
  const [target, setTarget] = useState(NEW_BOOK);
  const [newTitle, setNewTitle] = useState("");
  const [stratTitle, setStratTitle] = useState(initialTitle);
  const [layers, setLayers] = useState<SnapshotLayers>(DEFAULT_SNAPSHOT_LAYERS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ title: string; key: string } | null>(
    null,
  );

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
    if (!snapshotLayerSelected(layers)) {
      setError("Pick at least one layer to snapshot.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stamped = applySnapshotLayers(
        { pieces, groups, radarFx, drawings },
        layers,
      );
      const { book } = await writeSnapshot({
        mapName,
        bookKey: target === NEW_BOOK ? null : target,
        newBookTitle: newTitle,
        stratTitle,
        pieces: stamped.pieces,
        radarFx: stamped.radarFx,
        groups: stamped.groups,
        drawings: stamped.drawings,
        floor,
      });
      // Playbook reads this once on mount (`consumePlaybookFocus`) after navigate.
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
                Open strat
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              Pick a playbook for this map, then a new named strat. Analyzer ink
              stays unless Drawings is on.
            </p>
            <fieldset className="snapshot-layers">
              <legend>Include</legend>
              {SNAPSHOT_LAYER_OPTIONS.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    checked={layers[option.id]}
                    onChange={() =>
                      setLayers({ ...layers, [option.id]: !layers[option.id] })
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
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
              <button
                type="button"
                disabled={
                  saving || books == null || !snapshotLayerSelected(layers)
                }
                onClick={() => void save()}
              >
                Snapshot
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
