import { COLOR_PRESETS } from "./palettes";
import {
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type GrenadeKind,
  type Replay,
  type Stroke,
  type SummaryFilter,
} from "./types";

export const PROJECT_SCHEMA = 1;
const DB_NAME = "cs2analyzer";
const DB_VERSION = 1;
const STORE = "projects";

const KINDS: GrenadeKind[] = ["smoke", "flash", "he", "molotov", "decoy"];

export interface ReviewProject {
  schema: number;
  key: string;
  savedAt: number;
  fileName: string;
  mapName: string;
  tick: number;
  strokes: Stroke[];
  summaryFilter: SummaryFilter;
  floorMode: FloorMode;
  paletteId: string;
  color: string;
}

export interface ProjectBundle {
  schema: number;
  exportedAt: number;
  projects: ReviewProject[];
}

/** Map + roster + round count + filename. Overlay only — never the demo. */
export function matchKey(replay: Replay, fileName: string): string {
  const ids = replay.players
    .map((p) => p.steam_id)
    .sort((a, b) => a - b)
    .join(",");
  return `${replay.header.map_name}|${replay.rounds.length}|${ids}|${fileName}`;
}

export function defaultPaletteId(): string {
  return COLOR_PRESETS[0].id;
}

export function defaultColor(): string {
  return COLOR_PRESETS[0].colors[0];
}

function isPoint(v: unknown): v is { x: number; y: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as { x?: unknown; y?: unknown };
  return typeof o.x === "number" && typeof o.y === "number";
}

function optionalTick(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function withWindow<T extends Stroke>(base: T, o: Record<string, unknown>): T {
  const start_tick = optionalTick(o.start_tick);
  const end_tick = optionalTick(o.end_tick);
  const group = typeof o.group === "string" && o.group.trim() !== "" ? o.group.trim() : undefined;
  const hidden = o.hidden === true;
  return {
    ...base,
    ...(start_tick != null ? { start_tick } : {}),
    ...(end_tick != null ? { end_tick } : {}),
    ...(group ? { group } : {}),
    ...(hidden ? { hidden: true } : {}),
  };
}

function parseStroke(v: unknown): Stroke | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.round !== "number" || typeof o.color !== "string") return null;
  if (o.type === "pen" && Array.isArray(o.points) && o.points.every(isPoint)) {
    return withWindow({ type: "pen", round: o.round, color: o.color, points: o.points }, o);
  }
  if (o.type === "arrow" && isPoint(o.from) && isPoint(o.to)) {
    return withWindow({ type: "arrow", round: o.round, color: o.color, from: o.from, to: o.to }, o);
  }
  if (
    o.type === "text" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.text === "string" &&
    o.text.trim() !== ""
  ) {
    return withWindow(
      { type: "text", round: o.round, color: o.color, x: o.x, y: o.y, text: o.text },
      o,
    );
  }
  return null;
}

function parseFilter(v: unknown): SummaryFilter {
  if (!v || typeof v !== "object") return DEFAULT_SUMMARY_FILTER;
  const o = v as { kinds?: Record<string, unknown>; t?: unknown; ct?: unknown };
  const kinds = { ...DEFAULT_SUMMARY_FILTER.kinds };
  for (const k of KINDS) {
    if (typeof o.kinds?.[k] === "boolean") kinds[k] = o.kinds[k];
  }
  return {
    kinds,
    t: typeof o.t === "boolean" ? o.t : true,
    ct: typeof o.ct === "boolean" ? o.ct : true,
  };
}

function parseFloor(v: unknown): FloorMode {
  return v === "upper" || v === "lower" || v === "auto" ? v : "auto";
}

export function parseProject(raw: unknown): ReviewProject | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== PROJECT_SCHEMA || typeof o.key !== "string") return null;
  if (typeof o.fileName !== "string" || typeof o.mapName !== "string") return null;
  if (!Array.isArray(o.strokes)) return null;
  const strokes: Stroke[] = [];
  for (const s of o.strokes) {
    const st = parseStroke(s);
    if (st) strokes.push(st);
  }
  const paletteId =
    typeof o.paletteId === "string" && COLOR_PRESETS.some((p) => p.id === o.paletteId)
      ? o.paletteId
      : defaultPaletteId();
  const color = typeof o.color === "string" ? o.color : defaultColor();
  return {
    schema: PROJECT_SCHEMA,
    key: o.key,
    savedAt: typeof o.savedAt === "number" ? o.savedAt : 0,
    fileName: o.fileName,
    mapName: o.mapName,
    tick: typeof o.tick === "number" ? o.tick : 0,
    strokes,
    summaryFilter: parseFilter(o.summaryFilter),
    floorMode: parseFloor(o.floorMode),
    paletteId,
    color,
  };
}

export function parseBundle(raw: unknown): ProjectBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.projects)) {
    if (o.schema !== PROJECT_SCHEMA) return null;
    const projects: ReviewProject[] = [];
    for (const p of o.projects) {
      const proj = parseProject(p);
      if (proj) projects.push(proj);
    }
    return {
      schema: PROJECT_SCHEMA,
      exportedAt: typeof o.exportedAt === "number" ? o.exportedAt : 0,
      projects,
    };
  }
  const single = parseProject(raw);
  if (!single) return null;
  return { schema: PROJECT_SCHEMA, exportedAt: 0, projects: [single] };
}

export function serializeBundle(projects: ReviewProject[]): string {
  const bundle: ProjectBundle = {
    schema: PROJECT_SCHEMA,
    exportedAt: Date.now(),
    projects,
  };
  return JSON.stringify(bundle);
}

export function isNotesFile(file: File): boolean {
  return /\.json$/i.test(file.name) || file.type === "application/json";
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function requestOf<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

export async function saveProject(project: ReviewProject): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await requestOf(tx.objectStore(STORE).put({ ...project, savedAt: Date.now() }));
  } finally {
    db.close();
  }
}

export async function loadProject(key: string): Promise<ReviewProject | null> {
  if (!idbAvailable()) return null;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const raw = await requestOf(tx.objectStore(STORE).get(key));
    return parseProject(raw);
  } finally {
    db.close();
  }
}

export async function loadAllProjects(): Promise<ReviewProject[]> {
  if (!idbAvailable()) return [];
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const raw = await requestOf(tx.objectStore(STORE).getAll());
    const out: ReviewProject[] = [];
    for (const row of raw ?? []) {
      const p = parseProject(row);
      if (p) out.push(p);
    }
    return out;
  } finally {
    db.close();
  }
}

export async function importProjects(bundle: ProjectBundle): Promise<number> {
  if (!idbAvailable()) return bundle.projects.length;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const p of bundle.projects) {
      await requestOf(store.put({ ...p, savedAt: p.savedAt || Date.now() }));
    }
    return bundle.projects.length;
  } finally {
    db.close();
  }
}

export async function deleteProject(key: string): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await requestOf(tx.objectStore(STORE).delete(key));
  } finally {
    db.close();
  }
}

export async function countProjects(): Promise<number> {
  if (!idbAvailable()) return 0;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    return await requestOf(tx.objectStore(STORE).count());
  } finally {
    db.close();
  }
}
