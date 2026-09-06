import type { MapLayout } from "./types";
import { emptyLayout, formatLayout, parseMapLayout } from "./layout";

/** Load a layout already committed under apps/web/public/layouts/. */
export async function loadLayoutFile(map: string): Promise<MapLayout> {
  const res = await fetch(`/layouts/${map}.json`, { cache: "no-store" });
  if (res.status === 404) return emptyLayout(map);
  if (!res.ok) throw new Error(`could not load ${map} layout`);
  const parsed = parseMapLayout(await res.json(), map);
  return parsed ?? emptyLayout(map);
}

/** Write into apps/web/public/layouts/ through the local Vite server. */
export async function saveLayoutFile(layout: MapLayout): Promise<string> {
  const res = await fetch(`/__write/layouts/${layout.map}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: formatLayout(layout),
  });
  const body = (await res.json()) as { ok?: boolean; path?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? "save failed");
  return body.path ?? `apps/web/public/layouts/${layout.map}.json`;
}
