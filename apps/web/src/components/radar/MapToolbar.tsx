import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { DrawTool, FloorMode, MapLayers } from "@/lib/notes/types";

interface Props {
  tool: DrawTool;
  color: string;
  paletteId: string;
  follow: boolean;
  trails: boolean;
  moment: boolean;
  canFollow: boolean;
  layers: MapLayers;
  floorMode: FloorMode;
  hasFloors: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: DrawTool) => void;
  onColor: (c: string) => void;
  onPalette: (id: string) => void;
  onFollow: (v: boolean) => void;
  onTrails: (v: boolean) => void;
  onMoment: (v: boolean) => void;
  onLayers: (next: MapLayers) => void;
  onFloorMode: (mode: FloorMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onResetView: () => void;
  onStampBookmark: () => void;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBtn({
  title,
  on,
  disabled,
  onClick,
  d,
}: {
  title: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  d: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn${on ? " on" : ""}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon d={d} />
    </button>
  );
}

const I = {
  pan: "M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5 10 3.5M8 14.5 6 12.5M8 14.5 10 12.5M1.5 8 3.5 6M1.5 8 3.5 10M14.5 8 12.5 6M14.5 8 12.5 10",
  pen: "M11 2.5 13.5 5 6 12.5H3.5V10Z M8.5 5 11 7.5",
  arrow: "M3 13 13 3M8 3h5v5",
  text: "M3.5 3.5h9M8 3.5V13M5 13h6",
  erase: "M4.5 11.5 10 6l2.5 2.5-5.5 5.5H4.5v-2.5Z M6.5 13.5h6",
  undo: "M5 5 2 8l3 3M2 8h7.5a3.5 3.5 0 1 1 0 7",
  redo: "M11 5 14 8l-3 3M14 8H6.5a3.5 3.5 0 1 0 0 7",
  clear: "M5 5.5h6M6 5.5V4h4v1.5M6.5 5.5 7 13h2l.5-7.5",
  reset: "M3 8a5 5 0 1 0 1.5-3.5M3 3v3h3",
  track: "M8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 3.5V2M8 14v-1.5M3.5 8H2M14 8h-1.5",
  trail: "M3 12c2-1 3-4 5-4s3 3 5 2",
  moment: "M8 3.5A4.5 4.5 0 1 1 3.5 8M8 5.5V8l1.8 1.2",
  bookmark: "M4.5 2h7v12l-3.5-2.2L4.5 14Z",
};

export function MapToolbar({
  tool,
  color,
  paletteId,
  follow,
  trails,
  moment,
  canFollow,
  layers,
  floorMode,
  hasFloors,
  canUndo,
  canRedo,
  onTool,
  onColor,
  onPalette,
  onFollow,
  onTrails,
  onMoment,
  onLayers,
  onFloorMode,
  onUndo,
  onRedo,
  onClear,
  onResetView,
  onStampBookmark,
}: Props) {
  const toggle = (key: keyof MapLayers) => onLayers({ ...layers, [key]: !layers[key] });
  const preset = COLOR_PRESETS.find((p) => p.id === paletteId) ?? COLOR_PRESETS[0];
  return (
    <div className="map-toolbar">
      <IconBtn title="Pan" on={tool === "pan"} onClick={() => onTool("pan")} d={I.pan} />
      <IconBtn title="Draw" on={tool === "pen"} onClick={() => onTool("pen")} d={I.pen} />
      <IconBtn title="Arrow" on={tool === "arrow"} onClick={() => onTool("arrow")} d={I.arrow} />
      <IconBtn title="Text note" on={tool === "text"} onClick={() => onTool("text")} d={I.text} />
      <IconBtn
        title="Bookmark this tick (Moment: a few seconds). Nothing is drawn on the radar."
        on={tool === "bookmark"}
        onClick={() => {
          onTool("bookmark");
          onStampBookmark();
        }}
        d={I.bookmark}
      />
      <IconBtn title="Erase" on={tool === "eraser"} onClick={() => onTool("eraser")} d={I.erase} />
      <IconBtn title="Undo drawing (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} d={I.undo} />
      <IconBtn title="Redo drawing (Ctrl+Y)" disabled={!canRedo} onClick={onRedo} d={I.redo} />
      <IconBtn title="Clear drawings on this round" onClick={onClear} d={I.clear} />
      <IconBtn title="Reset view" onClick={onResetView} d={I.reset} />
      <span className="palette-picks">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === preset.id ? "on" : ""}
            onClick={() => onPalette(p.id)}
            title={p.label}
          >
            {p.label}
          </button>
        ))}
      </span>
      <span className="swatches">
        {preset.colors.map((c) => (
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
      <IconBtn
        title="Track player"
        on={follow}
        disabled={!canFollow}
        onClick={() => onFollow(!follow)}
        d={I.track}
      />
      <IconBtn title="Trail" on={trails} onClick={() => onTrails(!trails)} d={I.trail} />
      <IconBtn
        title="Moment: new drawings and bookmarks last a few seconds from this tick"
        on={moment}
        onClick={() => onMoment(!moment)}
        d={I.moment}
      />
      {hasFloors && (
        <span className="floor-picks">
          {(
            [
              ["auto", "Auto"],
              ["upper", "Upper"],
              ["lower", "Lower"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={floorMode === id ? "on" : ""}
              onClick={() => onFloorMode(id)}
            >
              {label}
            </button>
          ))}
        </span>
      )}
      <span className="toolbar-sep" />
      <button
        type="button"
        className={layers.grenades ? "on" : ""}
        onClick={() => toggle("grenades")}
      >
        Nades
      </button>
      <button type="button" className={layers.shots ? "on" : ""} onClick={() => toggle("shots")}>
        Shots
      </button>
      <button type="button" className={layers.deaths ? "on" : ""} onClick={() => toggle("deaths")}>
        Deaths
      </button>
      <button
        type="button"
        className={layers.openings ? "on" : ""}
        onClick={() => toggle("openings")}
      >
        FK
      </button>
      <button type="button" className={layers.names ? "on" : ""} onClick={() => toggle("names")}>
        Names
      </button>
      <button type="button" className={layers.cone ? "on" : ""} onClick={() => toggle("cone")}>
        Cone
      </button>
      <button
        type="button"
        className={layers.heatmap ? "on" : ""}
        onClick={() => toggle("heatmap")}
      >
        Heat
      </button>
      <button
        type="button"
        className={layers.summary ? "on" : ""}
        onClick={() => toggle("summary")}
      >
        Summary
      </button>
    </div>
  );
}
