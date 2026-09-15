import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { deleteProject } from "@/lib/notes/projectStore";
import { ROUTES } from "@/lib/app/routes";
import { useApp } from "@/lib/state/appState";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { DropZone } from "./DropZone";

interface Props {
  showSavedNotes: boolean;
  openAnalyzerOnDrop?: boolean;
  beside?: ReactNode;
  below?: ReactNode;
  children?: ReactNode;
}

/** DropZone wired to the live parse/notes session. */
export function DemoDrop({
  showSavedNotes,
  openAnalyzerOnDrop = false,
  beside,
  below,
  children,
}: Props) {
  const { session, status, review, onFiles } = useApp();
  const { settings } = useUserSettings();
  const navigate = useNavigate();
  return (
    <DropZone
      onFiles={(files) => {
        if (openAnalyzerOnDrop) navigate(ROUTES.analyzer);
        onFiles(files);
      }}
      onTryOpenSaved={(p) => review.tryOpenSaved(p)}
      onLinkDemoFile={(p) => void review.linkDemoFile(p)}
      parsing={session.parsing}
      progress={session.progress}
      parseFiles={session.parseFiles}
      onCancelParse={session.cancelParse}
      error={status.error}
      notice={status.notice}
      saved={review.saved}
      showSavedNotes={showSavedNotes}
      pageSize={settings.savedNotesPageSize}
      beside={beside}
      below={below}
      onDeleteNotes={(key) => {
        void deleteProject(key).then(review.refreshSaved);
      }}
    >
      {children}
    </DropZone>
  );
}
