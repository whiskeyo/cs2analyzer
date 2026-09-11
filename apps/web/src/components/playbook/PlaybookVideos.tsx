import { useEffect, useId, useRef, useState } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import { nextVideoPin, removeVideo } from "@/lib/playbook/videos";
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

export function PlaybookVideos({
  videos,
  onVideos,
  openId,
  onOpen,
  pendingPin,
  onCancelPin,
}: Props) {
  const { messages, t } = useMessages();
  const pasteTitleId = useId();
  const playerTitleId = useId();
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
    const parsed = parseYouTubeUrl(input);
    if (!parsed) {
      setError(messages.playbook.videoInvalid);
      return;
    }
    if (videos.some((clip) => sameYouTubeVideo(clip, parsed))) {
      setError(messages.playbook.videoDuplicate);
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
        {messages.playbook.videoLabel}
        <input
          ref={inputRef}
          aria-label={messages.playbook.videoLinkAria}
          value={input}
          placeholder={messages.playbook.videoPlaceholder}
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
        />
      </label>
      <button type="submit" disabled={pending || input.trim() === ""}>
        {pending ? messages.playbook.videoAdding : messages.playbook.videoAdd}
      </button>
    </form>
  );

  return (
    <div className="playbook-videos">
      {pendingPin ? null : addForm}
      {pendingPin ? null : error ? <p className="error">{error}</p> : null}
      {videos.length === 0 ? (
        <p className="playbook-lead">{messages.playbook.videoEmpty}</p>
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
                  className={
                    clip.id === openId ? "playbook-video-open is-active" : "playbook-video-open"
                  }
                  onClick={() => onOpen(clip.id)}
                >
                  <span className="playbook-video-thumb">
                    <img src={youtubeThumbUrl(clip.videoId)} alt="" loading="lazy" />
                  </span>
                  <span>{label}</span>
                </button>
                <button
                  type="button"
                  className="playbook-video-remove"
                  aria-label={t(messages.playbook.removeClip, { title: clip.title })}
                  onClick={() => remove(clip.id)}
                >
                  ×
                </button>
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
            <h2 id={pasteTitleId}>{messages.playbook.videoPinTitle}</h2>
            <p>{messages.playbook.videoPinLead}</p>
            {addForm}
            {error ? <p className="error">{error}</p> : null}
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={cancelPin}>
                {messages.preferences.cancel}
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
                {messages.playbook.videoOpen}
              </a>
              <button type="button" className="ghost" onClick={() => remove(open.id)}>
                {messages.drop.deleteNotes}
              </button>
              <button type="button" className="ghost" onClick={() => onOpen(null)}>
                {messages.preferences.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
