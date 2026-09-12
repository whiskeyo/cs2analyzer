import { useState } from "react";
import { CreatePlaybookDialog } from "@/components/playbook/CreatePlaybookDialog";
import { PlaybookMark } from "@/components/playbook/PlaybookMark";
import { useMessages } from "@/lib/i18n";
/** Dashed create-playbook card — same chrome as the Home dropzone pair. */
export function CreatePlaybookCard() {
  const { messages } = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="home-card home-playbook" onClick={() => setOpen(true)}>
        <PlaybookMark />
        <div className="drop-title">{messages.playbook.createTitle}</div>
        <p className="drop-blurb">{messages.playbook.createBlurb}</p>
        <p className="muted">{messages.playbook.createCta}</p>
      </button>
      {open ? <CreatePlaybookDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
