import type { FloorMode, MapLayers } from "@/lib/notes/types";
import type {
  DefaultDrawTool,
  DefaultSidebarTab,
  PdfPhotos,
  PdfTheme,
} from "@/lib/settings/userSettings";

export const LAYER_LABELS: { key: keyof MapLayers; label: string }[] = [
  { key: "grenades", label: "Nades" },
  { key: "shots", label: "Shots" },
  { key: "deaths", label: "Deaths" },
  { key: "openings", label: "FK" },
  { key: "names", label: "Names" },
  { key: "cone", label: "Cone" },
  { key: "heatmap", label: "Heat" },
  { key: "summary", label: "Summary" },
];

export const FLOOR_MODES: { id: FloorMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "upper", label: "Upper" },
  { id: "lower", label: "Lower" },
];

export const DRAW_TOOL_LABELS: Record<DefaultDrawTool, string> = {
  pan: "Pan",
  pen: "Pen",
};

export const SIDEBAR_TAB_LABELS: Record<DefaultSidebarTab, string> = {
  score: "Score",
  player: "Review",
  clutch: "Clutch",
  notes: "Notes",
  action: "Action",
  util: "Utility",
  rounds: "Rounds",
  weapons: "Weapons",
};

export const PDF_THEME_MODES: { id: PdfTheme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

export const PDF_PHOTO_MODES: { id: PdfPhotos; label: string }[] = [
  { id: "with", label: "With photos" },
  { id: "without", label: "Without photos" },
];

export function radarGrayValueText(amount: number): string {
  if (amount <= 0) {
    return "Color";
  }
  if (amount >= 1) {
    return "Gray";
  }
  return `${Math.round(amount * 100)}% gray`;
}
