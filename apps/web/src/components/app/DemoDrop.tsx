import { type ReactNode } from "react";
import { deleteProject } from "@/lib/notes/projectStore";
import { navigate, ROUTES } from "@/lib/app/devNavigate";
import { useApp } from "@/lib/state/appState";
import { DropZone } from "./DropZone";

interface Props {
  showSavedNotes: boolean;
  openAnalyzerOnDrop?: boolean;
  children?: ReactNode;
}

/** DropZone wired to the live parse/notes session. */
export function DemoDrop({ showSavedNotes, openAnalyzerOnDrop = false, children }: Props) {
  const { session, status, review, onFiles } = useApp();
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
      error={status.error}
      notice={status.notice}
      saved={review.saved}
      showSavedNotes={showSavedNotes}
      onDeleteNotes={(key) => {
        void deleteProject(key).then(review.refreshSaved);
      }}
    >
      {children}
    </DropZone>
  );
}
