/** Mouse position relative to a canvas wrap, in CSS pixels. */
export function wrapLocalPoint(
  wrap: HTMLElement,
  e: { clientX: number; clientY: number },
): { x: number; y: number } {
  const rect = wrap.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
