/** True when a text field has focus so map hotkeys should stay quiet. */
export function typingInField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}
