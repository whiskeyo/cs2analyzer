/** Stable key prefix for the in-memory tutorial book. Not a display title. */
export const TUTORIAL_PLAYBOOK_KEY = "tutorial-playbook";
export const TUTORIAL_PLAYBOOK_TITLE = "Tutorial";

export function tutorialPlaybookKey(mapName: string): string {
  return `${TUTORIAL_PLAYBOOK_KEY}:${mapName}`;
}

export function isTutorialPlaybookKey(key: string): boolean {
  return key === TUTORIAL_PLAYBOOK_KEY || key.startsWith(`${TUTORIAL_PLAYBOOK_KEY}:`);
}
