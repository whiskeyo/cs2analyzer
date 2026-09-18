/**
 * Sample playbook for the tutorial snapshot step.
 * Empty notes on purpose — no invented world coordinates. The tour fills this in.
 */

import { emptyNote } from "@/lib/notes/note";
import { defaultPlaybookColor, defaultPlaybookPaletteId } from "@/lib/playbook/pages";
import { PLAYBOOK_PREFERRED_MAP, PLAYBOOK_SCHEMA, type Playbook } from "@/lib/playbook/types";

export const TUTORIAL_PLAYBOOK_KEY = "tutorial-playbook";
export const TUTORIAL_PLAYBOOK_PAGE_ID = "tutorial-playbook-page";

export const tutorialPlaybook: Playbook = {
  schema: PLAYBOOK_SCHEMA,
  key: TUTORIAL_PLAYBOOK_KEY,
  mapName: PLAYBOOK_PREFERRED_MAP,
  title: "Tutorial",
  savedAt: 0,
  sort: 0,
  pages: [
    {
      id: TUTORIAL_PLAYBOOK_PAGE_ID,
      title: "Tutorial strat",
      body: "",
      floor: "auto",
      note: emptyNote(),
      videos: [],
      images: [],
      lowerNote: emptyNote(),
      lowerVideos: [],
      lowerImages: [],
    },
  ],
  activePageId: TUTORIAL_PLAYBOOK_PAGE_ID,
  paletteId: defaultPlaybookPaletteId(),
  color: defaultPlaybookColor(),
};
