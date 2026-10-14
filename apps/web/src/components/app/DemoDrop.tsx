import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { loadAllDemoTags } from "@/lib/demo/tagStore";
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
  const [tagsByKey, setTagsByKey] = useState<ReadonlyMap<string, readonly string[]>>(
    () => new Map(),
  );
  useEffect(() => {
    if (!showSavedNotes) return;
    let cancelled = false;
    void loadAllDemoTags()
      .then((map) => {
        if (cancelled) return;
        setTagsByKey((prev) => (prev.size === 0 && map.size === 0 ? prev : map));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [showSavedNotes, review.saved]);
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
      tagsByKey={tagsByKey}
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
