import { useState } from "react";
import { normalizeTags, tagsFromInput } from "@/lib/demo/tags";

interface Props {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

/** Chip list plus a field. Enter, comma, or blur commits. Spaces hyphenate. */
export function DemoTagEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const added = tagsFromInput(raw);
    if (added.length > 0) onChange(normalizeTags([...tags, ...added]));
    setDraft("");
  }

  return (
    <div className="demo-tags" role="group" aria-label="Demo tags">
      {tags.map((tag) => (
        <span key={tag} className="demo-tag">
          <span>#{tag}</span>
          <button
            type="button"
            className="demo-tag-remove"
            aria-label={`Remove tag ${tag}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="demo-tag-input"
        aria-label="Add tag"
        placeholder={tags.length === 0 ? "#tag" : ""}
        value={draft}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",")) {
            commit(value);
            return;
          }
          setDraft(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim() !== "") commit(draft);
        }}
      />
    </div>
  );
}
