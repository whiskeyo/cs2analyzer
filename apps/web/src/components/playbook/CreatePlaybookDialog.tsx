import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { playbookHref } from "@/lib/app/playbookSearch";
import { useMessages } from "@/lib/i18n/useMessages";
import { emitPlaybooksChanged } from "@/lib/playbook/events";
import { rememberPlaybookFocus } from "@/lib/playbook/focus";
import { pickInitialMap, sortedMapNames } from "@/lib/playbook/maps";
import { activePage } from "@/lib/playbook/pages";
import { createPlaybook } from "@/lib/playbook/playbookStore";
import { loadCalibrations } from "@/lib/radar/maps";
import { errorMessage } from "@/lib/validate/json.ts";
import { prettyMap } from "@/lib/weapons/weapons";

interface Props {
  onClose: () => void;
}

export function CreatePlaybookDialog({ onClose }: Props) {
  const { messages } = useMessages();
  const titleId = useId();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<string[] | null>(null);
  const [mapName, setMapName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCalibrations()
      .then((cals) => {
        if (cancelled) return;
        const names = sortedMapNames(cals);
        setMaps(names);
        setMapName((current) => current || pickInitialMap(names) || names[0] || "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async () => {
    if (!mapName) return;
    setSaving(true);
    setError(null);
    try {
      const book = await createPlaybook(mapName, title);
      const page = activePage(book);
      rememberPlaybookFocus({ mapName: book.mapName, bookKey: book.key });
      emitPlaybooksChanged();
      navigate(
        playbookHref({
          map: book.mapName,
          playbook: book.title,
          strat: page.title,
        }),
      );
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err) || messages.playbook.createError);
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
        <h2 id={titleId}>{messages.playbook.dialogTitle}</h2>
        <p>{messages.playbook.dialogLead}</p>
        <div className="home-create-fields">
          <label className="playbook-field">
            {messages.playbook.fieldMap}
            <select
              aria-label={messages.playbook.fieldMap}
              value={mapName}
              disabled={maps == null}
              onChange={(e) => setMapName(e.target.value)}
            >
              {(maps ?? []).map((name) => (
                <option key={name} value={name}>
                  {prettyMap(name)}
                </option>
              ))}
            </select>
          </label>
          <label className="playbook-field">
            {messages.playbook.fieldBookTitle}
            <input
              aria-label={messages.playbook.fieldBookTitle}
              value={title}
              placeholder={messages.playbook.untitledBook}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {messages.preferences.cancel}
          </button>
          <button type="button" disabled={saving || !mapName} onClick={() => void create()}>
            {messages.playbook.createSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
