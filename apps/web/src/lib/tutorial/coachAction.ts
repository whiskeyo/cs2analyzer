/** CustomEvent name for coach `doneWhen` actions that are not a plain click. */
export const TUTORIAL_COACH_ACTION_EVENT = "cs2analyzer:tutorial-action";

export const TUTORIAL_COACH_ACTIONS = [
  "play-or-scrub",
  "draw",
  "open-notes",
  "next-aggregated",
  "switch-side",
  "open-util",
  "jump-grenade",
  "toggle-buy",
  "next-playbook",
  "open-strat",
  "finish",
] as const;

export type TutorialCoachAction = (typeof TUTORIAL_COACH_ACTIONS)[number];

export function isTutorialCoachAction(value: unknown): value is TutorialCoachAction {
  return typeof value === "string" && (TUTORIAL_COACH_ACTIONS as readonly string[]).includes(value);
}

export function emitTutorialCoachAction(action: TutorialCoachAction): void {
  window.dispatchEvent(new CustomEvent(TUTORIAL_COACH_ACTION_EVENT, { detail: action }));
}

export function onTutorialCoachAction(handler: (action: TutorialCoachAction) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isTutorialCoachAction(detail)) handler(detail);
  };
  window.addEventListener(TUTORIAL_COACH_ACTION_EVENT, listener);
  return () => window.removeEventListener(TUTORIAL_COACH_ACTION_EVENT, listener);
}

/** Resolve `data-tutorial-action` from a click / input / change target. */
export function tutorialCoachActionFromEvent(event: Event): TutorialCoachAction | null {
  const node = event.target;
  if (!(node instanceof Element)) return null;
  const el = node.closest("[data-tutorial-action]");
  if (!(el instanceof HTMLElement)) return null;
  return isTutorialCoachAction(el.dataset.tutorialAction) ? el.dataset.tutorialAction : null;
}
