import { deleteProject } from "@/lib/notes/projectStore";
import { useApp } from "@/lib/state/appState";
import { DropZone } from "./DropZone";

export function Splash() {
  const { session, status, review, onFile } = useApp();
  return (
    <div className="app splash">
      <DropZone
        onFile={onFile}
        onExportNotes={() => void review.exportNotes()}
        parsing={session.parsing}
        progress={session.progress}
        error={status.error}
        notice={status.notice}
        saved={review.saved}
        onDeleteNotes={(key) => {
          void deleteProject(key).then(review.refreshSaved);
        }}
        onWantDemo={(name) =>
          status.setNotice(`Drop ${name} to restore those notes. The demo itself is not stored.`)
        }
      />
    </div>
  );
}
