import { useState } from "react";
import { NoteMarkupEditor } from "@/components/playbook/NoteMarkupEditor";
import { PieceList } from "@/components/playbook/PieceList";
import { PlaybookVideos } from "@/components/playbook/PlaybookVideos";
import type { Note } from "@/lib/notes/types";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import {
  groupOverlayItems,
  renamePlaybookGroup,
  setGroupHidden,
  ungroupPlaybookGroup,
} from "@/lib/playbook/groups";
import { overlayRows, removeOverlay } from "@/lib/playbook/overlay";
import { setPieceLabel } from "@/lib/playbook/pieces";

interface Props {
  stratTitle: string;
  body: string;
  videos: PlaybookYouTube[];
  openVideoId: string | null;
  pendingPin: { x: number; y: number } | null;
  onCancelPin: () => void;
  selectedId: string | null;
  onBody: (body: string) => void;
  onVideos: (videos: PlaybookYouTube[]) => void;
  onOpenVideo: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onNote: (note: Note) => void;
  note: Note;
}

export function PlaybookStratPanel({
  stratTitle,
  body,
  videos,
  openVideoId,
  pendingPin,
  onCancelPin,
  selectedId,
  onBody,
  onVideos,
  onOpenVideo,
  onSelect,
  onNote,
  note,
}: Props) {
  const [radarOpen, setRadarOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const rows = overlayRows(note);
  const count = rows.length;

  const togglePicked = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <h2>Strat</h2>
      <p className="playbook-lead">{stratTitle}</p>
      <PlaybookVideos
        videos={videos}
        onVideos={onVideos}
        openId={openVideoId}
        onOpen={onOpenVideo}
        pendingPin={pendingPin}
        onCancelPin={onCancelPin}
      />
      <div className="playbook-field playbook-notes-field">
        <span>Strat notes</span>
        <NoteMarkupEditor value={body} onChange={onBody} />
      </div>
      <div className="playbook-tokens">
        <button
          type="button"
          className="playbook-fold"
          aria-expanded={radarOpen}
          onClick={() => setRadarOpen((open) => !open)}
        >
          On radar ({count})
        </button>
        {radarOpen ? (
          <div className="playbook-radar-panel">
            <div className="playbook-group-bar">
              <button
                type="button"
                className="ghost"
                disabled={picked.size < 2}
                onClick={() => {
                  onNote(groupOverlayItems(note, [...picked]));
                  setPicked(new Set());
                }}
              >
                Group selected
              </button>
            </div>
            <PieceList
              note={note}
              selectedId={selectedId}
              picked={picked}
              onTogglePick={togglePicked}
              onSelect={onSelect}
              onRename={(id, label) => onNote(setPieceLabel(note, id, label))}
              onRemove={(id) => {
                const pieceId = id.startsWith("piece:") ? id.slice("piece:".length) : null;
                onNote(removeOverlay(note, id));
                if (pieceId && selectedId === pieceId) onSelect(null);
                setPicked((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              }}
              onRenameGroup={(groupId, name) => onNote(renamePlaybookGroup(note, groupId, name))}
              onToggleGroup={(groupId, hidden) => onNote(setGroupHidden(note, groupId, hidden))}
              onUngroup={(groupId) => onNote(ungroupPlaybookGroup(note, groupId))}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
