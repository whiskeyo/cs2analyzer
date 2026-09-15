import { useEffect, useId, useRef, useState } from "react";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import { nextVideoPin, removeVideo, renameVideo, reorderVideos } from "@/lib/playbook/videos";
import { useEditableName } from "@/lib/shared/useEditableName";
import {
  fetchYouTubeTitle,
  formatVideoStart,
  parseYouTubeUrl,
  sameYouTubeVideo,
  youtubeEmbedUrl,
  youtubeThumbUrl,
  youtubeWatchUrl,
  YOUTUBE_UNTITLED,
} from "@/lib/playbook/youtube";

interface Props {
  videos: PlaybookYouTube[];
  onVideos: (videos: PlaybookYouTube[]) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  pendingPin: { x: number; y: number } | null;
  onCancelPin: () => void;
}

function VideoTitle({
  clip,
  onRename,
}: {
  clip: PlaybookYouTube;
  onRename: (id: string, title: string) => void;
}) {
  const { draft, editing, beginEdit, setDraft, commit, onKeyDown } = useEditableName(
    clip.title,
    (next) => onRename(clip.id, next),
  );
  if (!editing) {
    return (
      <span
        className="playbook-video-title"
        title="Double-click to rename"
        onDoubleClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          beginEdit();
        }}
      >
        {clip.title}
      </span>
    );
  }
  return (
    <input
      className="playbook-video-title"
      value={draft}
      aria-label={`Rename ${clip.title}`}
      autoFocus
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

export function PlaybookVideos({
  videos,
  onVideos,
  openId,
  onOpen,
  pendingPin,
  onCancelPin,
}: Props) {
  const pasteTitleId = useId();
  const playerTitleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const open = videos.find((clip) => clip.id === openId) ?? null;
  const playing = open != null && playingId === open.id;
  const parsed = parseYouTubeUrl(input);
  const pasteError =
    input.trim() !== "" && !parsed ? "Paste a YouTube link (youtube.com or youtu.be)." : error;

  useEffect(() => {
    if (!pendingPin) return;
    inputRef.current?.focus();
  }, [pendingPin]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) {
        onOpen(null);
        return;
      }
      if (!pendingPin) return;
      setError(null);
      setInput("");
      onCancelPin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pendingPin, onOpen, onCancelPin]);

  const cancelPin = () => {
    setError(null);
    setInput("");
    onCancelPin();
  };

  const add = async () => {
    const next = parseYouTubeUrl(input);
    if (!next) {
      setError("Paste a YouTube link (youtube.com or youtu.be).");
      return;
    }
    if (videos.some((clip) => sameYouTubeVideo(clip, next))) {
      setError("That video is already on this strat.");
      return;
    }
    setPending(true);
    setError(null);
    const title = (await fetchYouTubeTitle(next.videoId)) ?? YOUTUBE_UNTITLED;
    const at = pendingPin ?? nextVideoPin(videos);
    const clip: PlaybookYouTube = {
      id: crypto.randomUUID(),
      videoId: next.videoId,
      url: youtubeWatchUrl(next.videoId, next.startSeconds),
      title,
      x: at.x,
      y: at.y,
      ...(next.startSeconds != null ? { startSeconds: next.startSeconds } : {}),
    };
    onVideos([...videos, clip]);
    setInput("");
    setPending(false);
    onCancelPin();
  };

  const remove = (id: string) => {
    onVideos(removeVideo(videos, id));
    if (openId === id) onOpen(null);
  };

  const addForm = (
    <form
      className="playbook-video-add"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <label className="playbook-field">
        YouTube
        <input
          ref={inputRef}
          aria-label="YouTube link"
          value={input}
          placeholder="https://youtu.be/…"
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
        />
      </label>
      <button type="submit" disabled={pending || !parsed}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );

  return (
    <div className="playbook-videos">
      {videos.length === 0 ? (
        <p className="playbook-lead">
          Place a YouTube pin on the radar. Clips stay on this machine.
        </p>
      ) : (
        <ul className="playbook-video-list">
          {videos.map((clip, index) => {
            const start =
              clip.startSeconds != null ? ` · ${formatVideoStart(clip.startSeconds)}` : "";
            const label = `${clip.title}${start}`;
            return (
              <li key={clip.id} className="playbook-video">
                <button
                  type="button"
                  className={
                    clip.id === openId ? "playbook-video-open is-active" : "playbook-video-open"
                  }
                  aria-label={label}
                  onClick={() => {
                    setPlayingId(null);
                    onOpen(clip.id);
                  }}
                >
                  <span className="playbook-video-thumb">
                    <img src={youtubeThumbUrl(clip.videoId)} alt="" loading="lazy" />
                  </span>
                </button>
                <span className="playbook-video-meta">
                  <VideoTitle
                    clip={clip}
                    onRename={(id, title) => onVideos(renameVideo(videos, id, title))}
                  />
                  {start !== "" ? (
                    <span className="playbook-video-start">{start.trim()}</span>
                  ) : null}
                </span>
                <div className="playbook-video-tools">
                  <button
                    type="button"
                    className="playbook-video-move"
                    aria-label={`Move ${clip.title} up`}
                    disabled={index === 0}
                    onClick={() => onVideos(reorderVideos(videos, index, index - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="playbook-video-move"
                    aria-label={`Move ${clip.title} down`}
                    disabled={index === videos.length - 1}
                    onClick={() => onVideos(reorderVideos(videos, index, index + 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="playbook-video-remove"
                    aria-label={`Remove ${clip.title}`}
                    onClick={() => remove(clip.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pendingPin ? (
        <div className="home-modal playbook-video-paste" onClick={cancelPin}>
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={pasteTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={pasteTitleId}>Add YouTube clip</h2>
            <p>Paste a youtube.com or youtu.be link for this pin.</p>
            {addForm}
            {parsed ? (
              <div className="playbook-video-preview">
                <img src={youtubeThumbUrl(parsed.videoId)} alt="" />
              </div>
            ) : null}
            {pasteError ? <p className="error">{pasteError}</p> : null}
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={cancelPin}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {open ? (
        <div className="home-modal playbook-video-modal" onClick={() => onOpen(null)}>
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={playerTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={playerTitleId}>{open.title}</h2>
            <div className="playbook-video-frame">
              {playing ? (
                <iframe
                  src={youtubeEmbedUrl(open.videoId, open.startSeconds)}
                  title={open.title}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className="playbook-video-poster"
                  onClick={() => setPlayingId(open.id)}
                >
                  <img src={youtubeThumbUrl(open.videoId)} alt="" />
                  <span>Play</span>
                </button>
              )}
            </div>
            <div className="home-modal-actions">
              <a href={open.url} target="_blank" rel="noreferrer">
                Open on YouTube
              </a>
              <button type="button" className="ghost" onClick={() => remove(open.id)}>
                Delete
              </button>
              <button type="button" className="ghost" onClick={() => onOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
