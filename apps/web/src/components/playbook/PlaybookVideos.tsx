import { useEffect, useId, useRef, useState } from "react";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import { nextVideoPin } from "@/lib/playbook/videos";
import {
  fetchYouTubeTitle,
  formatVideoStart,
  parseYouTubeUrl,
  sameYouTubeVideo,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  YOUTUBE_UNTITLED,
} from "@/lib/playbook/youtube";

interface Props {
  videos: PlaybookYouTube[];
  onVideos: (videos: PlaybookYouTube[]) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  pendingPin: { x: number; y: number } | null;
}

export function PlaybookVideos({ videos, onVideos, openId, onOpen, pendingPin }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const open = videos.find((clip) => clip.id === openId) ?? null;

  useEffect(() => {
    if (!pendingPin) return;
    inputRef.current?.focus();
  }, [pendingPin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpen]);

  const add = async () => {
    const parsed = parseYouTubeUrl(input);
    if (!parsed) {
      setError("Paste a YouTube link (youtube.com or youtu.be).");
      return;
    }
    if (videos.some((clip) => sameYouTubeVideo(clip, parsed))) {
      setError("That video is already on this strat.");
      return;
    }
    setPending(true);
    setError(null);
    const title = (await fetchYouTubeTitle(parsed.videoId)) ?? YOUTUBE_UNTITLED;
    const at = pendingPin ?? nextVideoPin(videos);
    const clip: PlaybookYouTube = {
      id: crypto.randomUUID(),
      videoId: parsed.videoId,
      url: youtubeWatchUrl(parsed.videoId, parsed.startSeconds),
      title,
      x: at.x,
      y: at.y,
      ...(parsed.startSeconds != null ? { startSeconds: parsed.startSeconds } : {}),
    };
    onVideos([...videos, clip]);
    setInput("");
    setPending(false);
    onOpen(clip.id);
  };

  const removeOpen = () => {
    if (!open) return;
    onVideos(videos.filter((clip) => clip.id !== open.id));
    onOpen(null);
  };

  return (
    <div className="playbook-videos">
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
        <button type="submit" disabled={pending || input.trim() === ""}>
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {pendingPin ? (
        <p className="playbook-lead">Pin on the radar — paste a YouTube link.</p>
      ) : null}
      {videos.length === 0 && !pendingPin ? (
        <p className="playbook-lead">
          Place a YouTube token or paste a link. Clips stay on this machine.
        </p>
      ) : (
        <ul className="playbook-pieces">
          {videos.map((clip) => {
            const label =
              clip.startSeconds != null
                ? `${clip.title} · ${formatVideoStart(clip.startSeconds)}`
                : clip.title;
            return (
              <li key={clip.id} className="playbook-piece playbook-piece-mark">
                <button
                  type="button"
                  className={clip.id === openId ? "playbook-book is-active" : "playbook-book"}
                  onClick={() => onOpen(clip.id)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <div className="home-modal playbook-video-modal" onClick={() => onOpen(null)}>
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{open.title}</h2>
            <div className="playbook-video-frame">
              <iframe
                src={youtubeEmbedUrl(open.videoId, open.startSeconds)}
                title={open.title}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="home-modal-actions">
              <a href={open.url} target="_blank" rel="noreferrer">
                Open on YouTube
              </a>
              <button type="button" className="ghost" onClick={removeOpen}>
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
