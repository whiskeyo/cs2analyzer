import { PLAYBOOK_IMAGE_PIN_HEIGHT, PLAYBOOK_IMAGE_PIN_WIDTH } from "@/lib/playbook/images";
import { worldToScreen } from "@/lib/radar/maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { PLAYBOOK_PDF_PIN_HIT_MIN, PLAYBOOK_PDF_RADAR_SIZE } from "./constants";

/** Same identity view the offscreen PDF still uses. */
const SNAPSHOT_VIEW = { scale: 1, ox: 0, oy: 0 };

export function playbookPdfPinHit(
  world: { x: number; y: number },
  cal: MapCalibration | undefined,
  still: { x: number; y: number; width: number; height: number },
  snapshotSize = PLAYBOOK_PDF_RADAR_SIZE,
): { x: number; y: number; width: number; height: number } {
  const screen = worldToScreen(cal, snapshotSize, snapshotSize, SNAPSHOT_VIEW, world.x, world.y);
  const scaleX = still.width / snapshotSize;
  const scaleY = still.height / snapshotSize;
  const cx = still.x + screen.x * scaleX;
  const cy = still.y + still.height - screen.y * scaleY;
  const width = Math.max(PLAYBOOK_IMAGE_PIN_WIDTH * scaleX, PLAYBOOK_PDF_PIN_HIT_MIN);
  const height = Math.max(PLAYBOOK_IMAGE_PIN_HEIGHT * scaleY, PLAYBOOK_PDF_PIN_HIT_MIN);
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
