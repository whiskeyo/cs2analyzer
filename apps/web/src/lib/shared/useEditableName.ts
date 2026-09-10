import { useRef, useState } from "react";

/** Shared double-click rename machine used by layout and notes group fields. */
export function useEditableName(
  shown: string,
  onCommit: (next: string) => void,
  sameAs: readonly string[] = [],
): {
  draft: string;
  editing: boolean;
  beginEdit: () => void;
  setDraft: (next: string) => void;
  commit: () => void;
  onKeyDown: (e: {
    key: string;
    preventDefault: () => void;
    currentTarget: { blur: () => void };
  }) => void;
} {
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  const skipBlur = useRef(false);

  const beginEdit = () => {
    setDraft(shown);
    setEditing(true);
  };

  const commit = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next || next === shown || sameAs.includes(next)) {
      setDraft(shown);
      return;
    }
    onCommit(next);
  };

  const onKeyDown = (e: {
    key: string;
    preventDefault: () => void;
    currentTarget: { blur: () => void };
  }) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      skipBlur.current = true;
      setDraft(shown);
      e.currentTarget.blur();
    }
  };

  return { draft, editing, beginEdit, setDraft, commit, onKeyDown };
}
