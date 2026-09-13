import { useEffect, useId, useRef, useState } from "react";
import { ingestPlaybookImages } from "@/lib/playbook/addPlaybookImages";
import { PLAYBOOK_IMAGE_MAX_MB, removeImage } from "@/lib/playbook/images";
import { peekPlaybookImageBitmap } from "@/lib/playbook/playbookImageBitmaps";
import type { PlaybookImage } from "@/lib/playbook/types";
import { usePlaybookImageBitmaps } from "@/lib/playbook/usePlaybookImageBitmaps";

const ACCEPT = "image/png,image/jpeg,image/webp";

interface Props {
  images: PlaybookImage[];
  onImages: (images: PlaybookImage[]) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  error: string | null;
  onError: (message: string | null) => void;
}

export function PlaybookImages({ images, onImages, openId, onOpen, error, onError }: Props) {
  const inputId = useId();
  const viewerTitleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const bitmaps = usePlaybookImageBitmaps(images.map((image) => image.id));
  const open = images.find((image) => image.id === openId) ?? null;
  const openSrc = open ? (bitmaps.get(open.id)?.src ?? peekPlaybookImageBitmap(open.id)?.src) : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;
      onOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpen]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setPending(true);
    const result = await ingestPlaybookImages(files, images);
    setPending(false);
    onImages(result.images);
    onError(result.error);
    if (inputRef.current) inputRef.current.value = "";
    const added = result.images[result.images.length - 1];
    if (added && added !== images[images.length - 1]) onOpen(added.id);
  };

  const remove = (id: string) => {
    onImages(removeImage(images, id));
    if (openId === id) onOpen(null);
  };

  return (
    <div className="playbook-videos">
      <div className="playbook-video-add">
        <label className="playbook-field" htmlFor={inputId}>
          Images
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            aria-label="Add playbook image"
            disabled={pending}
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
            }}
          />
        </label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {images.length === 0 ? (
        <p className="playbook-lead">
          Place a photo pin or drop a PNG, JPEG, or WebP on the radar ({PLAYBOOK_IMAGE_MAX_MB} MB
          max). Files stay on this machine.
        </p>
      ) : (
        <ul className="playbook-video-list">
          {images.map((image) => {
            const thumb = bitmaps.get(image.id) ?? peekPlaybookImageBitmap(image.id);
            return (
              <li key={image.id} className="playbook-video">
                <button
                  type="button"
                  className={
                    image.id === openId ? "playbook-video-open is-active" : "playbook-video-open"
                  }
                  onClick={() => onOpen(image.id)}
                >
                  <span className="playbook-video-thumb">
                    {thumb ? <img src={thumb.src} alt="" /> : null}
                  </span>
                  <span>{image.name}</span>
                </button>
                <button
                  type="button"
                  className="playbook-video-remove"
                  aria-label={`Remove ${image.name}`}
                  onClick={() => remove(image.id)}
                >
                  ×
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
            aria-labelledby={viewerTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={viewerTitleId}>{open.name}</h2>
            <div className="playbook-image-frame">
              {openSrc ? <img src={openSrc} alt={open.name} /> : null}
            </div>
            <div className="home-modal-actions">
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
