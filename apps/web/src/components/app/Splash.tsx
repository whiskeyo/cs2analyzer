import { deleteProject } from "@/lib/notes/projectStore";
import { useApp } from "@/lib/state/appState";
import { DropZone } from "./DropZone";

export function Splash() {
  const { session, status, review, onFiles } = useApp();
  return (
    <div className="app splash">
      <DropZone
        onFiles={onFiles}
        onExportNotes={() => void review.exportNotes()}
        onRemoveAllNotes={() => void review.removeAllNotes()}
        onTryOpenSaved={(p) => review.tryOpenSaved(p)}
        onLinkDemoFile={(p) => void review.linkDemoFile(p)}
        parsing={session.parsing}
        progress={session.progress}
        parseFiles={session.parseFiles}
        error={status.error}
        notice={status.notice}
        saved={review.saved}
        onDeleteNotes={(key) => {
          void deleteProject(key).then(review.refreshSaved);
        }}
      />
    </div>
  );
}
