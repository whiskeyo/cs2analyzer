import { useEffect, useId, useState } from "react";
import type { PlaybookYouTube } from "@/lib/playbook/types";
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
}

export function PlaybookVideos({ videos, onVideos }: Props) {
  const titleId = useId();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = videos.find((clip) => clip.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    onVideos([
      ...videos,
      {
        id: crypto.randomUUID(),
        videoId: parsed.videoId,
        url: youtubeWatchUrl(parsed.videoId, parsed.startSeconds),
        title,
        ...(parsed.startSeconds != null ? { startSeconds: parsed.startSeconds } : {}),
      },
    ]);
    setInput("");
    setPending(false);
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
      {videos.length === 0 ? (
        <p className="playbook-lead">
          Lineup or tutorial clips for this strat. Stays on this machine.
        </p>
      ) : (
        <ul className="playbook-video-list">
          {videos.map((clip) => {
            const label =
              clip.startSeconds != null
                ? `${clip.title} · ${formatVideoStart(clip.startSeconds)}`
                : clip.title;
            return (
              <li key={clip.id} className="playbook-video">
                <button
                  type="button"
                  className="playbook-video-open"
                  onClick={() => setOpenId(clip.id)}
                >
                  <img src={youtubeThumbUrl(clip.videoId)} alt="" loading="lazy" />
                  <span>{label}</span>
                </button>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Remove ${clip.title}`}
                  onClick={() => onVideos(videos.filter((row) => row.id !== clip.id))}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <div className="home-modal playbook-video-modal" onClick={() => setOpenId(null)}>
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
              <button type="button" className="ghost" onClick={() => setOpenId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
