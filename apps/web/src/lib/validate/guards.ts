export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function optionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}
