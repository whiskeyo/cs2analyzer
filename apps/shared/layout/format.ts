import type { LayoutCallout, MapLayout } from "./types.ts";

/** Persist a single polygon as `polygon` so existing map JSON stays stable. */
export function serializeCallout(callout: LayoutCallout): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: callout.id,
    name: callout.name,
    floor: callout.floor,
  };
  const only = callout.regions[0];
  if (callout.regions.length === 1 && only?.kind === "polygon") {
    row.polygon = only.points;
  } else {
    row.regions = callout.regions;
  }
  if (callout.group) {
    row.group = callout.group;
  }
  return row;
}

/** Same as `.prettierrc.json` printWidth so Save to folder passes `format:check`. */
export const LAYOUT_JSON_PRINT_WIDTH = 100;

const JSON_INDENT = 2;

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Pretty-print JSON the way Prettier does (printWidth 100, indent 2, no trailing commas). */
function formatJson(value: unknown, depth = 0, prefixLen = 0): string {
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(isJsonPrimitive)) {
      const compact = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
      if (prefixLen + compact.length <= LAYOUT_JSON_PRINT_WIDTH) return compact;
    }
    const innerDepth = depth + 1;
    const inner = " ".repeat(innerDepth * JSON_INDENT);
    const pad = " ".repeat(depth * JSON_INDENT);
    const items = value.map((item) => `${inner}${formatJson(item, innerDepth, inner.length)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const innerDepth = depth + 1;
    const inner = " ".repeat(innerDepth * JSON_INDENT);
    const pad = " ".repeat(depth * JSON_INDENT);
    const row = value as Record<string, unknown>;
    const items = keys.map((key) => {
      const label = `${JSON.stringify(key)}: `;
      const printed = formatJson(row[key], innerDepth, inner.length + label.length);
      return `${inner}${label}${printed}`;
    });
    return `{\n${items.join(",\n")}\n${pad}}`;
  }
  return "null";
}

export function formatLayout(layout: MapLayout): string {
  const callouts = layout.callouts.map(serializeCallout);
  const body =
    layout.groups && layout.groups.length > 0
      ? {
          schema: layout.schema,
          map: layout.map,
          groups: layout.groups,
          callouts,
        }
      : { schema: layout.schema, map: layout.map, callouts };
  return `${formatJson(body)}\n`;
}
