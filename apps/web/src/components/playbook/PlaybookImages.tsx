import { useId, useRef, useState } from "react";
import { ingestPlaybookImages } from "@/lib/playbook/addPlaybookImages";
import { PLAYBOOK_IMAGE_MAX_MB, removeImage } from "@/lib/playbook/images";
import { peekPlaybookImageBitmap } from "@/lib/playbook/playbookImageBitmaps";
import type { PlaybookImage } from "@/lib/playbook/types";

const ACCEPT = "image/png,image/jpeg,image/webp";

interface Props {
  images: PlaybookImage[];
  selectedId: string | null;
  onImages: (images: PlaybookImage[]) => void;
  onSelect: (id: string | null) => void;
  error: string | null;
  onError: (message: string | null) => void;
}

export function PlaybookImages({ images, selectedId, error, onImages, onSelect, onError }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setPending(true);
    const result = await ingestPlaybookImages(files, images);
    setPending(false);
    onImages(result.images);
    onError(result.error);
    if (inputRef.current) inputRef.current.value = "";
    const added = result.images[result.images.length - 1];
    if (added && added !== images[images.length - 1]) onSelect(added.id);
  };

  const remove = (id: string) => {
    onImages(removeImage(images, id));
    if (selectedId === id) onSelect(null);
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
          Drop a PNG, JPEG, or WebP on the radar ({PLAYBOOK_IMAGE_MAX_MB} MB max). Files stay on
          this machine.
        </p>
      ) : (
        <ul className="playbook-video-list">
          {images.map((image) => {
            const thumb = peekPlaybookImageBitmap(image.id);
            return (
              <li key={image.id} className="playbook-video">
                <button
                  type="button"
                  className={
                    image.id === selectedId
                      ? "playbook-video-open is-active"
                      : "playbook-video-open"
                  }
                  onClick={() => onSelect(image.id)}
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
    </div>
  );
}
