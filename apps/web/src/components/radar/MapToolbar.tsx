import { ColorPalette } from "@/components/notes/ColorPalette";
import { ToolbarIconBtn } from "@/components/map/ToolbarIcon";
import { MATCH_PDF_BOOKMARK_TOOLTIP } from "@/lib/export/constants";
import type { MapToolbarProps } from "./mapToolbarTypes";

export function MapToolbar({
  review,
  view,
  reviewActions,
  viewActions,
  onSnapshot,
  drawingsEnabled = true,
}: MapToolbarProps) {
  const { tool, color, paletteId, floorMode, hasFloors, canUndo, canRedo } = review;
  const { follow, trails, moment, canFollow, layers } = view;
  const { onTool, onColor, onPalette, onFloorMode, onUndo, onRedo, onClear, onStampBookmark } =
    reviewActions;
  const { onFollow, onTrails, onMoment, onLayers, onResetView } = viewActions;
  const draw = drawingsEnabled;

  const toggle = (key: keyof typeof layers) => onLayers({ ...layers, [key]: !layers[key] });
  return (
    <div className="map-toolbar">
      <ToolbarIconBtn title="Pan" on={tool === "pan"} onClick={() => onTool("pan")} path="pan" />
      <span
        className="map-toolbar-draw"
        data-tutorial="draw"
        role="toolbar"
        aria-label="Draw tools"
      >
        <ToolbarIconBtn
          title="Draw"
          on={tool === "pen"}
          disabled={!draw}
          onClick={() => onTool("pen")}
          path="pen"
        />
        <ToolbarIconBtn
          title="Arrow"
          on={tool === "arrow"}
          disabled={!draw}
          onClick={() => onTool("arrow")}
          path="arrow"
        />
        <ToolbarIconBtn
          title="Text note"
          on={tool === "text"}
          disabled={!draw}
          onClick={() => onTool("text")}
          path="text"
        />
        <ToolbarIconBtn
          title={MATCH_PDF_BOOKMARK_TOOLTIP}
          on={tool === "bookmark"}
          disabled={!draw}
          onClick={() => {
            onTool("bookmark");
            onStampBookmark();
          }}
          path="bookmark"
        />
        <ToolbarIconBtn
          title="Erase"
          on={tool === "eraser"}
          disabled={!draw}
          onClick={() => onTool("eraser")}
          path="erase"
        />
      </span>
      <ToolbarIconBtn
        title="Undo drawing (Ctrl+Z)"
        disabled={!draw || !canUndo}
        onClick={onUndo}
        path="undo"
      />
      <ToolbarIconBtn
        title="Redo drawing (Ctrl+Y)"
        disabled={!draw || !canRedo}
        onClick={onRedo}
        path="redo"
      />
      <ToolbarIconBtn
        title="Clear drawings on this round"
        disabled={!draw}
        onClick={onClear}
        path="clear"
      />
      <ToolbarIconBtn title="Reset view" onClick={onResetView} path="reset" />
      {onSnapshot ? (
        <ToolbarIconBtn title="Snapshot to playbook" onClick={onSnapshot} path="snapshot" />
      ) : null}
      <ColorPalette
        paletteId={paletteId}
        color={color}
        onPalette={onPalette}
        onColor={onColor}
        disabled={!draw}
      />
      <ToolbarIconBtn
        title="Track player"
        on={follow}
        disabled={!canFollow}
        onClick={() => onFollow(!follow)}
        path="track"
      />
      <ToolbarIconBtn title="Trail" on={trails} onClick={() => onTrails(!trails)} path="trail" />
      <ToolbarIconBtn
        title="Moment: new drawings and bookmarks last a few seconds from this tick"
        on={moment}
        disabled={!draw}
        onClick={() => onMoment(!moment)}
        path="moment"
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
