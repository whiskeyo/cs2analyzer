import { useRef, useState, type ReactNode } from "react";
import { PieceList } from "@/components/playbook/PieceList";
import { PlaybookVideos } from "@/components/playbook/PlaybookVideos";
import type { Note } from "@/lib/notes/types";
import { parseNoteMarkup, wrapNoteMarkup } from "@/lib/playbook/noteMarkup";
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
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [radarOpen, setRadarOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const rows = overlayRows(note);
  const count = rows.length;

  const applyMark = (marker: string) => {
    const el = notesRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = wrapNoteMarkup(body, start, end, marker);
    onBody(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  };

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
        <div className="playbook-notes-toolbar" role="toolbar" aria-label="Strat notes style">
          <button
            type="button"
            className="ghost"
            title="Bold (**text**)"
            onClick={() => applyMark("**")}
          >
            Bold
          </button>
          <button
            type="button"
            className="ghost"
            title="Italic (*text*)"
            onClick={() => applyMark("*")}
          >
            Italic
          </button>
          <button
            type="button"
            className="ghost"
            title="Underline (__text__)"
            onClick={() => applyMark("__")}
          >
            Underline
          </button>
        </div>
        <textarea
          ref={notesRef}
          aria-label="Strat notes"
          rows={12}
          value={body}
          placeholder="Callouts, timings, utility… **bold** *italic* __underline__"
          onChange={(e) => onBody(e.target.value)}
        />
        <p className="playbook-notes-hint">**bold** · *italic* or _italic_ · __underline__</p>
        <NoteMarkupPreview text={body} />
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

function NoteMarkupPreview({ text }: { text: string }) {
  if (text.trim() === "") return null;
  return (
    <div className="playbook-notes-preview" aria-label="Strat notes preview">
      {text.split("\n").map((line, lineIndex) => (
        <p key={lineIndex}>
          {parseNoteMarkup(line).map((span, index) => {
            let node: ReactNode = span.text;
            if (span.underline) node = <u>{node}</u>;
            if (span.italic) node = <em>{node}</em>;
            if (span.bold) node = <strong>{node}</strong>;
            return <span key={index}>{node}</span>;
          })}
        </p>
      ))}
    </div>
  );
}
