export const PLAYBOOK_FOCUS_KEY = "cs2analyzer.playbook.focus";

export type PlaybookFocus = {
  mapName: string;
  bookKey: string;
};

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function rememberPlaybookFocus(focus: PlaybookFocus): void {
  const store = sessionStore();
  if (!store) return;
  store.setItem(PLAYBOOK_FOCUS_KEY, JSON.stringify(focus));
}

export function consumePlaybookFocus(): PlaybookFocus | null {
  const store = sessionStore();
  if (!store) return null;
  const raw = store.getItem(PLAYBOOK_FOCUS_KEY);
  store.removeItem(PLAYBOOK_FOCUS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Record<string, unknown>;
    if (typeof row.mapName !== "string" || row.mapName.trim() === "") return null;
    if (typeof row.bookKey !== "string" || row.bookKey.trim() === "") return null;
    return { mapName: row.mapName, bookKey: row.bookKey };
  } catch {
    return null;
  }
}
