import { useEffect, useId, useState } from "react";
import type { Drawing, DrawingGroup, FloorMode, NoteRadarFx, Piece } from "@/lib/notes/types";
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
import {
  defaultSnapshotBookKey,
  loadRecentPlaybookKeys,
  partitionRecentPlaybooks,
  rememberRecentPlaybook,
} from "@/lib/playbook/snapshotRecent";
import { UNTITLED_PLAYBOOK, type Playbook } from "@/lib/playbook/types";
import { isTutorialPlaybookKey } from "@/lib/tutorial/playbook/constants";
import { tutorialSnapshotDestination, writeTutorialSnapshot } from "@/lib/tutorial/playbook/live";
import { errorMessage } from "@/lib/validate/json.ts";
import type { SnapshotToastInfo } from "./SnapshotToast";

const NEW_BOOK = "new";

interface Props {
  mapName: string;
  pieces: Piece[];
  groups?: DrawingGroup[];
  drawings?: Drawing[];
  radarFx?: NoteRadarFx;
  stratTitle: string;
  floor: FloorMode;
  /** Tutorial analyzer: list every destination, but only the sample Playbook is active. */
  lockToTutorial?: boolean;
  onClose: () => void;
  onSaved?: (saved: SnapshotToastInfo) => void;
}

function BookOption({
  book,
  target,
  onPick,
  disabled,
}: {
  book: Playbook;
  target: string;
  onPick: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "is-disabled" : undefined}>
      <input
        type="radio"
        name="snapshot-book"
        checked={target === book.key}
        disabled={disabled}
        onChange={() => onPick(book.key)}
      />
      {book.title}
    </label>
  );
}

export function SnapshotDialog({
  mapName,
  pieces,
  groups,
  drawings,
  radarFx,
  stratTitle: initialTitle,
  floor,
  lockToTutorial = false,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId();
  const [books, setBooks] = useState<Playbook[] | null>(() =>
    lockToTutorial ? [tutorialSnapshotDestination(mapName)] : null,
  );
  const [target, setTarget] = useState(
    lockToTutorial ? tutorialSnapshotDestination(mapName).key : NEW_BOOK,
  );
  const [newTitle, setNewTitle] = useState("");
  const [stratTitle, setStratTitle] = useState(initialTitle);
  const [layers, setLayers] = useState<SnapshotLayers>(DEFAULT_SNAPSHOT_LAYERS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recentKeys = loadRecentPlaybookKeys();
  const { recent, rest } = partitionRecentPlaybooks(books ?? [], recentKeys);

  useEffect(() => {
    let cancelled = false;
    void listPlaybooksForMap(mapName)
      .then((list) => {
        if (cancelled) return;
        if (lockToTutorial) {
          const sample = tutorialSnapshotDestination(mapName);
          const rest = list.filter((book) => book.key !== sample.key);
          setBooks([sample, ...rest]);
          setTarget(sample.key);
          return;
        }
        setBooks(list);
        setTarget(defaultSnapshotBookKey(list, loadRecentPlaybookKeys()) ?? NEW_BOOK);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mapName, lockToTutorial]);

  const save = async () => {
    if (!snapshotLayerSelected(layers)) {
      setError("Pick at least one layer to snapshot.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stamped = applySnapshotLayers({ pieces, groups, radarFx, drawings }, layers);
      const savedBook = lockToTutorial
        ? writeTutorialSnapshot({
            mapName,
            stratTitle,
            pieces: stamped.pieces,
            radarFx: stamped.radarFx,
            groups: stamped.groups,
            drawings: stamped.drawings,
            floor,
          }).book
        : (
            await writeSnapshot({
              mapName,
              bookKey: target === NEW_BOOK ? null : target,
              newBookTitle: newTitle,
              stratTitle,
              pieces: stamped.pieces,
              radarFx: stamped.radarFx,
              groups: stamped.groups,
              drawings: stamped.drawings,
              floor,
            })
          ).book;
      if (!lockToTutorial) {
        rememberPlaybookFocus({ mapName, bookKey: savedBook.key });
        rememberRecentPlaybook(savedBook.key);
      }
      onSaved?.({
        mapName,
        bookTitle: savedBook.title,
        bookKey: savedBook.key,
        stratTitle,
      });
      onClose();
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
        <p>
          Pick a playbook for this map, then a new named strat. Analyzer ink stays unless Drawings
          is on.
        </p>
        {lockToTutorial ? (
          <p className="snapshot-tutorial-hint">
            During the tutorial, only the sample Playbook can receive a snapshot. Other destinations
            stay listed but inactive.
          </p>
        ) : null}
        <fieldset className="snapshot-layers">
          <legend>Include</legend>
          {SNAPSHOT_LAYER_OPTIONS.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={layers[option.id]}
                onChange={() => setLayers({ ...layers, [option.id]: !layers[option.id] })}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="snapshot-books">
          <legend>Playbook</legend>
          {recent.length > 0 ? <p className="snapshot-recent-hint">Recent</p> : null}
          {recent.map((book) => (
            <BookOption
              key={book.key}
              book={book}
              target={target}
              onPick={setTarget}
              disabled={lockToTutorial && !isTutorialPlaybookKey(book.key)}
            />
          ))}
          {rest.length > 0 && recent.length > 0 ? (
            <p className="snapshot-recent-hint">All</p>
          ) : null}
          {rest.map((book) => (
            <BookOption
              key={book.key}
              book={book}
              target={target}
              onPick={setTarget}
              disabled={lockToTutorial && !isTutorialPlaybookKey(book.key)}
            />
          ))}
          <label className={lockToTutorial ? "is-disabled" : undefined}>
            <input
              type="radio"
              name="snapshot-book"
              checked={target === NEW_BOOK}
              disabled={lockToTutorial}
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
            disabled={saving || books == null || !snapshotLayerSelected(layers)}
            onClick={() => void save()}
          >
            Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
