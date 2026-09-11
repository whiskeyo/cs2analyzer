import { useState } from "react";
import { CreatePlaybookDialog } from "@/components/playbook/CreatePlaybookDialog";
import { PlaybookMark } from "@/components/playbook/PlaybookMark";

/** Dashed create-playbook card — same chrome as the Home dropzone pair. */
export function CreatePlaybookCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="home-card home-playbook" onClick={() => setOpen(true)}>
        <PlaybookMark />
        <div className="drop-title">Create a playbook</div>
        <p className="drop-blurb">Draw named strats on a radar. No demo required.</p>
        <p className="muted">Open playbook.</p>
      </button>
      {open ? <CreatePlaybookDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
