import { playbookHref } from "@/lib/app/playbookSearch";
import { ROUTES } from "@/lib/app/routes";
import { PLAYBOOK_PREFERRED_MAP } from "@/lib/playbook/types";
import { TUTORIAL_PLAYBOOK_KEY, TUTORIAL_PLAYBOOK_PAGE_ID } from "./playbook/constants";

export const TUTORIAL_QUERY = "tutorial" as const;

export const TUTORIAL_STEPS = ["replay", "aggregated", "playbook"] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

const REPLAY_VALUES = new Set(["", "1", "true", "replay"]);
const AGGREGATED_VALUES = new Set(["aggregated", "series", "2"]);
const PLAYBOOK_VALUES = new Set(["playbook", "3"]);

function readParam(params: URLSearchParams, key: string): string | null {
  if (!params.has(key)) return null;
  return params.get(key) ?? "";
}

/** `?tutorial=1` (Replay), `?tutorial=aggregated` (habits), `?tutorial=playbook`. */
export function parseTutorialQuery(search: string): TutorialStep | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = readParam(new URLSearchParams(raw), TUTORIAL_QUERY);
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (REPLAY_VALUES.has(normalized)) return "replay";
  if (AGGREGATED_VALUES.has(normalized)) return "aggregated";
  if (PLAYBOOK_VALUES.has(normalized)) return "playbook";
  return null;
}

export function tutorialSearch(step: TutorialStep): string {
  const params = new URLSearchParams();
  if (step === "aggregated") params.set(TUTORIAL_QUERY, "aggregated");
  else if (step === "playbook") params.set(TUTORIAL_QUERY, "playbook");
  else params.set(TUTORIAL_QUERY, "1");
  return `?${params.toString()}`;
}

export function tutorialHref(step: TutorialStep = "replay"): string {
  if (step === "playbook") {
    const href = playbookHref({
      map: PLAYBOOK_PREFERRED_MAP,
      playbook: TUTORIAL_PLAYBOOK_KEY,
      strat: TUTORIAL_PLAYBOOK_PAGE_ID,
    });
    const qIndex = href.indexOf("?");
    const path = qIndex >= 0 ? href.slice(0, qIndex) : href;
    const params = new URLSearchParams(qIndex >= 0 ? href.slice(qIndex + 1) : "");
    params.set(TUTORIAL_QUERY, "playbook");
    return `${path}?${params.toString()}`;
  }
  return `${ROUTES.analyzer}${tutorialSearch(step)}`;
}

export function nextTutorialStep(step: TutorialStep): TutorialStep | null {
  const index = TUTORIAL_STEPS.indexOf(step);
  if (index < 0 || index >= TUTORIAL_STEPS.length - 1) return null;
  return TUTORIAL_STEPS[index + 1];
}

export function previousTutorialStep(step: TutorialStep): TutorialStep | null {
  const index = TUTORIAL_STEPS.indexOf(step);
  if (index <= 0) return null;
  return TUTORIAL_STEPS[index - 1];
}
