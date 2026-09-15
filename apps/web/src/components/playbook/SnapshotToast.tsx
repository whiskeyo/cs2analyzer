import { useNavigate } from "react-router";
import { playbookHref } from "@/lib/app/playbookSearch";
import { rememberPlaybookFocus } from "@/lib/playbook/focus";

export interface SnapshotToastInfo {
  mapName: string;
  bookTitle: string;
  bookKey: string;
  stratTitle: string;
}

interface Props extends SnapshotToastInfo {
  onDismiss: () => void;
}

export function SnapshotToast({ mapName, bookTitle, bookKey, stratTitle, onDismiss }: Props) {
  const navigate = useNavigate();
  return (
    <div className="snapshot-toast" role="status">
      <p>
        Saved to <strong>{bookTitle}</strong>
        {stratTitle.trim() !== "" ? <> · {stratTitle}</> : null}
      </p>
      <div className="snapshot-toast-actions">
        <button
          type="button"
          onClick={() => {
            rememberPlaybookFocus({ mapName, bookKey });
            navigate(
              playbookHref({
                map: mapName,
                playbook: bookTitle,
                strat: stratTitle,
              }),
            );
            onDismiss();
          }}
        >
          Open strat
        </button>
        <button type="button" className="ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
