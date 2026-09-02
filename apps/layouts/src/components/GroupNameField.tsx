import { useRef, useState } from "react";
import { LAYOUT_GROUP_NAME_MAX } from "@/lib/constants";
import { groupLabel } from "@/lib/groups";

export function GroupNameField({
  groupId,
  onRenameGroup,
}: {
  groupId: string;
  onRenameGroup: (fromId: string, name: string) => void;
}) {
  const shown = groupLabel(groupId);
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  const skipBlur = useRef(false);

  const commit = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next) {
      setDraft(shown);
      return;
    }
    if (next === groupId || next === shown) {
      setDraft(shown);
      return;
    }
    onRenameGroup(groupId, next);
  };

  if (!editing) {
    return (
      <span
        className="callout-group-name"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraft(shown);
          setEditing(true);
        }}
      >
        {shown}
      </span>
    );
  }

  return (
    <input
      className="callout-group-name"
      value={draft}
      maxLength={LAYOUT_GROUP_NAME_MAX}
      aria-label="Group name"
      draggable={false}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          skipBlur.current = true;
          setDraft(shown);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
