import { LAYOUT_GROUP_NAME_MAX } from "@/lib/layouts/constants";
import { groupLabel } from "@/lib/layouts/groups";
import { useEditableName } from "@/lib/shared/useEditableName";

export function GroupNameField({
  groupId,
  onRenameGroup,
}: {
  groupId: string;
  onRenameGroup: (fromId: string, name: string) => void;
}) {
  const shown = groupLabel(groupId);
  const { draft, editing, beginEdit, setDraft, commit, onKeyDown } = useEditableName(
    shown,
    (next) => onRenameGroup(groupId, next),
    [groupId],
  );

  if (!editing) {
    return (
      <span
        className="callout-group-name"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          beginEdit();
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
      onKeyDown={onKeyDown}
    />
  );
}
