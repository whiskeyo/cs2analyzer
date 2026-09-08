/** Fired after import / delete so the Playbook page can reload from IndexedDB. */
export const PLAYBOOKS_CHANGED_EVENT = "cs2analyzer:playbooks-changed";

export function emitPlaybooksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAYBOOKS_CHANGED_EVENT));
}
