import { useState } from "react";
import { PieceList } from "@/components/playbook/PieceList";
import { PlaybookImages } from "@/components/playbook/PlaybookImages";
import { PlaybookVideos } from "@/components/playbook/PlaybookVideos";
import type { Note } from "@/lib/notes/types";
import type { PlaybookImage, PlaybookYouTube } from "@/lib/playbook/types";
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
  images: PlaybookImage[];
  openVideoId: string | null;
  pendingPin: { x: number; y: number } | null;
  onCancelPin: () => void;
  pendingImagePin: { x: number; y: number } | null;
  onCancelImagePin: () => void;
  selectedId: string | null;
  openImageId: string | null;
  onBody: (body: string) => void;
  onVideos: (videos: PlaybookYouTube[]) => void;
  onImages: (images: PlaybookImage[]) => void;
  onOpenImage: (id: string | null) => void;
  imageError: string | null;
  onImageError: (message: string | null) => void;
  onOpenVideo: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onNote: (note: Note) => void;
  note: Note;
}

export function PlaybookStratPanel({
  stratTitle,
  body,
  videos,
  images,
  openVideoId,
  pendingPin,
  onCancelPin,
  pendingImagePin,
  onCancelImagePin,
  selectedId,
  openImageId,
  onBody,
  onVideos,
  onImages,
  onOpenImage,
  imageError,
  onImageError,
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
      <PlaybookImages
        images={images}
        openId={openImageId}
        error={imageError}
        pendingPin={pendingImagePin}
        onCancelPin={onCancelImagePin}
        onImages={onImages}
        onOpen={onOpenImage}
        onError={onImageError}
      />
      <label className="playbook-field playbook-notes-field">
        Strat notes
        <textarea
          value={body}
          onChange={(event) => onBody(event.target.value)}
          placeholder="Callouts, timings, utility…"
        />
      </label>
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
