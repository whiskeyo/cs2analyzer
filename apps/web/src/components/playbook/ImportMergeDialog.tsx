import { useMemo, useState } from "react";
import { useMessages } from "@/lib/i18n";
import type {
  ImportConflict,
  ImportChoices,
  BookImportAction,
  StratImportAction,
} from "@/lib/playbook/merge";
import { stratConflictLabel, uniqueBookTitle } from "@/lib/playbook/merge";
import { copiedTitle } from "@/lib/playbook/pages";

interface Props {
  conflicts: ImportConflict[];
  onCancel: () => void;
  onConfirm: (choices: ImportChoices) => void;
}

export function ImportMergeDialog({ conflicts, onCancel, onConfirm }: Props) {
  const { messages, t } = useMessages();
  const defaults = useMemo(() => {
    const next: ImportChoices = {};
    for (const row of conflicts) {
      const strats: Record<string, StratImportAction> = {};
      for (const strat of row.stratConflicts) strats[strat.pageId] = "rename";
      next[row.incoming.key] = { action: "rename", title: copiedTitle(row.incoming.title), strats };
    }
    return next;
  }, [conflicts]);
  const [choices, setChoices] = useState<ImportChoices>(defaults);

  const setAction = (key: string, action: BookImportAction) => {
    setChoices((prev) => {
      const current = prev[key] ?? { action: "rename" as const };
      return { ...prev, [key]: { ...current, action } };
    });
  };

  return (
    <div className="playbook-merge-mask" role="dialog" aria-labelledby="playbook-merge-title">
      <div className="playbook-merge">
        <h2 id="playbook-merge-title">{messages.playbook.importTitle}</h2>
        <p className="playbook-lead">{messages.playbook.importLead}</p>
        {conflicts.map((row) => {
          const choice = choices[row.incoming.key] ?? { action: "rename" as const };
          const used = new Set(
            conflicts
              .filter((other) => other.existing.mapName === row.existing.mapName)
              .map((other) => other.existing.title),
          );
          return (
            <fieldset key={row.incoming.key} className="playbook-merge-book">
              <legend>
                {row.incoming.title} ({row.incoming.mapName})
              </legend>
              <label>
                <input
                  type="radio"
                  name={`book-${row.incoming.key}`}
                  checked={choice.action === "replace"}
                  onChange={() => setAction(row.incoming.key, "replace")}
                />
                {messages.playbook.importReplaceMine}
              </label>
              <label>
                <input
                  type="radio"
                  name={`book-${row.incoming.key}`}
                  checked={choice.action === "rename"}
                  onChange={() => setAction(row.incoming.key, "rename")}
                />
                {messages.playbook.importKeepBoth}
                {choice.action === "rename" ? (
                  <input
                    type="text"
                    aria-label={t(messages.playbook.newTitleFor, { title: row.incoming.title })}
                    value={choice.title ?? uniqueBookTitle(copiedTitle(row.incoming.title), used)}
                    onChange={(e) =>
                      setChoices((prev) => ({
                        ...prev,
                        [row.incoming.key]: { ...prev[row.incoming.key], title: e.target.value },
                      }))
                    }
                  />
                ) : null}
              </label>
              <label>
                <input
                  type="radio"
                  name={`book-${row.incoming.key}`}
                  checked={choice.action === "merge"}
                  onChange={() => setAction(row.incoming.key, "merge")}
                />
                {messages.playbook.importMerge}
              </label>
              {choice.action === "merge" && row.stratConflicts.length > 0 ? (
                <ul className="playbook-merge-strats">
                  {row.stratConflicts.map((strat) => {
                    const action = choice.strats?.[strat.pageId] ?? "rename";
                    const label = stratConflictLabel(row.stratConflicts, strat.pageId);
                    return (
                      <li key={strat.pageId}>
                        <span>{label}</span>
                        <select
                          aria-label={t(messages.playbook.stratNamed, { label })}
                          value={action}
                          onChange={(e) =>
                            setChoices((prev) => ({
                              ...prev,
                              [row.incoming.key]: {
                                ...prev[row.incoming.key],
                                strats: {
                                  ...prev[row.incoming.key]?.strats,
                                  [strat.pageId]: e.target.value as StratImportAction,
                                },
                              },
                            }))
                          }
                        >
                          <option value="replace">{messages.playbook.importReplace}</option>
                          <option value="rename">{messages.playbook.importRename}</option>
                          <option value="skip">{messages.playbook.importSkip}</option>
                        </select>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </fieldset>
          );
        })}
        <div className="playbook-merge-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {messages.preferences.cancel}
          </button>
          <button type="button" onClick={() => onConfirm(choices)}>
            {messages.playbook.importSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
