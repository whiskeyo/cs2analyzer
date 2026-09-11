/**
 * Vite worker URL lives only here so Home/FAQ/Playbook stay off the WASM graph.
 * Import this module through `ensureParser()` — never from the app shell.
 */
export function createParseWorker(): Worker {
  return new Worker(new URL("./parseWorker.ts", import.meta.url), { type: "module" });
}
