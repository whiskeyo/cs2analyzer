import { ROUTES } from "@/lib/app/routes";

export const TUTORIAL_QUERY = "tutorial" as const;

export type TutorialStep = "replay" | "aggregated";

const REPLAY_VALUES = new Set(["", "1", "true", "replay"]);
const AGGREGATED_VALUES = new Set(["aggregated", "series"]);

function readParam(params: URLSearchParams, key: string): string | null {
  if (!params.has(key)) return null;
  return params.get(key) ?? "";
}

/** `?tutorial=1` (single Mirage sample) or `?tutorial=aggregated` (habits series). */
export function parseTutorialQuery(search: string): TutorialStep | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = readParam(new URLSearchParams(raw), TUTORIAL_QUERY);
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (REPLAY_VALUES.has(normalized)) return "replay";
  if (AGGREGATED_VALUES.has(normalized)) return "aggregated";
  return null;
}

export function tutorialSearch(step: TutorialStep): string {
  const params = new URLSearchParams();
  params.set(TUTORIAL_QUERY, step === "aggregated" ? "aggregated" : "1");
  return `?${params.toString()}`;
}

export function tutorialHref(step: TutorialStep = "replay"): string {
  return `${ROUTES.analyzer}${tutorialSearch(step)}`;
}
