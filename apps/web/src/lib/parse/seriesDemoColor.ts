/** Distinct hues for up to eight demos in a series (stable by load order). */
const DEMO_HUES = [210, 280, 32, 155, 350, 125, 45, 300];

export function seriesDemoColor(index: number): string {
  const hue = DEMO_HUES[index % DEMO_HUES.length] ?? 0;
  return `hsl(${hue}, 62%, 52%)`;
}

export function seriesDemoColors(demoIds: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  demoIds.forEach((id, index) => out.set(id, seriesDemoColor(index)));
  return out;
}
