import { useEffect, useState } from "react";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { pickInitialMap, sortedMapNames } from "@/lib/playbook/maps";
import { activePage } from "@/lib/playbook/pages";
import { usePlaybooks } from "@/lib/playbook/usePlaybooks";
import { UNTITLED_PLAYBOOK } from "@/lib/playbook/types";
import { loadCalibrations } from "@/lib/radar/maps";
import { prettyMap } from "@/lib/weapons/weapons";
import { errorMessage } from "@/lib/validate/json.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function Playbook() {
  const [maps, setMaps] = useState<Record<string, MapCalibration> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const names = maps ? sortedMapNames(maps) : [];
  const { books, book, activeKey, select, create, rename } = usePlaybooks(mapName);

  useEffect(() => {
    let cancelled = false;
    void loadCalibrations()
      .then((cals) => {
        if (cancelled) return;
        setMaps(cals);
        setMapName((current) => current ?? pickInitialMap(sortedMapNames(cals)));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cal = mapName && maps ? maps[mapName] : undefined;
  const page = book ? activePage(book) : null;

  return (
    <div className="playbook">
      <aside className="playbook-sidebar">
        <h2>Playbook</h2>
        <p className="playbook-lead">Maps, then named books. Drawings stay on this machine.</p>
        {loadError ? <p className="error">{loadError}</p> : null}
        <label className="playbook-field">
          Map
          <select
            aria-label="Map"
            value={mapName ?? ""}
            disabled={names.length === 0}
            onChange={(e) => setMapName(e.target.value || null)}
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {prettyMap(name)}
              </option>
            ))}
          </select>
        </label>
        <form
          className="playbook-create"
          onSubmit={(e) => {
            e.preventDefault();
            void create(newTitle);
            setNewTitle("");
          }}
        >
          <input
            aria-label="New playbook title"
            value={newTitle}
            placeholder={UNTITLED_PLAYBOOK}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="ghost" disabled={!mapName}>
            New playbook
          </button>
        </form>
        <ul className="playbook-books">
          {books.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={row.key === activeKey ? "playbook-book is-active" : "playbook-book"}
                onClick={() => select(row.key)}
              >
                {row.title}
              </button>
            </li>
          ))}
        </ul>
        {book ? (
          <label className="playbook-field">
            Book title
            <input
              aria-label="Book title"
              value={book.title}
              onChange={(e) => rename(e.target.value)}
            />
          </label>
        ) : (
          <p className="muted">Create a playbook for this map, or open one from the list.</p>
        )}
      </aside>
      <div className="playbook-stage">
        {page && mapName ? (
          <PlaybookCanvas cal={cal} floorMode={page.floor} note={page.note} />
        ) : (
          <div className="playbook-empty muted">Open a playbook to draw on the radar.</div>
        )}
      </div>
    </div>
  );
}
