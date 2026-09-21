import { tutorialSeriesManifest } from "../multi-demo/manifest";

/** Stable IndexedDB key for the sample book. Not a display title. */
export const TUTORIAL_PLAYBOOK_KEY = "tutorial-playbook";
/**
 * Sample book + Habits snapshots follow the Aggregated series map (`de_dust2`),
 * not the default Playbook landing map (Mirage).
 */
export const TUTORIAL_PLAYBOOK_MAP = tutorialSeriesManifest.mapName;
/** Habits-overlay snapshot style page shipped with the sample book. */
export const TUTORIAL_PLAYBOOK_HABITS_PAGE_ID = "tutorial-playbook-habits";
/** Hand-authored execute page shipped with the sample book. */
export const TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID = "tutorial-playbook-drawn";
