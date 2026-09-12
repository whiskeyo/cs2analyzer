import { useRef } from "react";
import { useMessages } from "@/lib/i18n";
interface Props {
  onFile: (file: File) => void;
}

/** Same size as Export notes — a real button, not a padded file label. */
export function ImportNotesButton({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages } = useMessages();
  return (
    <>
      <button type="button" className="ghost" onClick={() => inputRef.current?.click()}>
        {messages.settings.importNotes}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
