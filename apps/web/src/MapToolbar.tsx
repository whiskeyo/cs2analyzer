import type { DrawTool, MapLayers } from "./types";

const COLORS = ["#f4d35e", "#ee6c4d", "#7eb7e6", "#80ed99", "#ffffff"];

interface Props {
  tool: DrawTool;
  color: string;
  follow: boolean;
  trails: boolean;
  canFollow: boolean;
  layers: MapLayers;
  onTool: (t: DrawTool) => void;
  onColor: (c: string) => void;
  onFollow: (v: boolean) => void;
  onTrails: (v: boolean) => void;
  onLayers: (next: MapLayers) => void;
  onClear: () => void;
  onResetView: () => void;
}

export function MapToolbar({
  tool,
  color,
  follow,
  trails,
  canFollow,
  layers,
  onTool,
  onColor,
  onFollow,
  onTrails,
  onLayers,
  onClear,
  onResetView,
}: Props) {
  const toggle = (key: keyof MapLayers) => onLayers({ ...layers, [key]: !layers[key] });
  return (
    <div className="map-toolbar">
      <button type="button" className={tool === "pan" ? "on" : ""} onClick={() => onTool("pan")}>
        Pan
      </button>
      <button type="button" className={tool === "pen" ? "on" : ""} onClick={() => onTool("pen")}>
        Draw
      </button>
      <button type="button" className={tool === "arrow" ? "on" : ""} onClick={() => onTool("arrow")}>
        Arrow
      </button>
      <button
        type="button"
        className={tool === "eraser" ? "on" : ""}
        onClick={() => onTool("eraser")}
      >
        Erase
      </button>
      <button type="button" onClick={onClear}>
        Clear
      </button>
      <button type="button" onClick={onResetView}>
        Reset
      </button>
      <span className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${color === c ? " on" : ""}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            aria-label={c}
          />
        ))}
      </span>
      <button
        type="button"
        className={follow ? "on" : ""}
        disabled={!canFollow}
        onClick={() => onFollow(!follow)}
      >
        Track
      </button>
      <button type="button" className={trails ? "on" : ""} onClick={() => onTrails(!trails)}>
        Trail
      </button>
      <span className="toolbar-sep" />
      <button type="button" className={layers.grenades ? "on" : ""} onClick={() => toggle("grenades")}>
        Nades
      </button>
      <button type="button" className={layers.shots ? "on" : ""} onClick={() => toggle("shots")}>
        Shots
      </button>
      <button type="button" className={layers.deaths ? "on" : ""} onClick={() => toggle("deaths")}>
        Deaths
      </button>
      <button type="button" className={layers.names ? "on" : ""} onClick={() => toggle("names")}>
        Names
      </button>
      <button type="button" className={layers.cone ? "on" : ""} onClick={() => toggle("cone")}>
        Cone
      </button>
      <button type="button" className={layers.heatmap ? "on" : ""} onClick={() => toggle("heatmap")}>
        Heat
      </button>
    </div>
  );
}
