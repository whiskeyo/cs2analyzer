import { ColorPalette } from "@/components/notes/ColorPalette";
import { ToolbarIconBtn } from "@/components/map/ToolbarIcon";
import { floorLabel } from "@/lib/i18n/labels";
import { useMessages } from "@/lib/i18n/useMessages";
import type { FloorMode } from "@/lib/notes/types";
import type { MapToolbarProps } from "./mapToolbarTypes";

export function MapToolbar({
  review,
  view,
  reviewActions,
  viewActions,
  onSnapshot,
}: MapToolbarProps) {
  const { tool, color, paletteId, floorMode, hasFloors, canUndo, canRedo } = review;
  const { follow, trails, moment, canFollow, layers } = view;
  const { onTool, onColor, onPalette, onFloorMode, onUndo, onRedo, onClear, onStampBookmark } =
    reviewActions;
  const { onFollow, onTrails, onMoment, onLayers, onResetView } = viewActions;

  const { messages } = useMessages();
  const toggle = (key: keyof typeof layers) => onLayers({ ...layers, [key]: !layers[key] });
  const floors: FloorMode[] = ["auto", "upper", "lower"];
  return (
    <div className="map-toolbar">
      <ToolbarIconBtn
        title={messages.toolbar.pan}
        on={tool === "pan"}
        onClick={() => onTool("pan")}
        path="pan"
      />
      <ToolbarIconBtn
        title={messages.toolbar.draw}
        on={tool === "pen"}
        onClick={() => onTool("pen")}
        path="pen"
      />
      <ToolbarIconBtn
        title={messages.toolbar.arrow}
        on={tool === "arrow"}
        onClick={() => onTool("arrow")}
        path="arrow"
      />
      <ToolbarIconBtn
        title={messages.toolbar.textNote}
        on={tool === "text"}
        onClick={() => onTool("text")}
        path="text"
      />
      <ToolbarIconBtn
        title={messages.toolbar.bookmarkTick}
        on={tool === "bookmark"}
        onClick={() => {
          onTool("bookmark");
          onStampBookmark();
        }}
        path="bookmark"
      />
      <ToolbarIconBtn
        title={messages.toolbar.erase}
        on={tool === "eraser"}
        onClick={() => onTool("eraser")}
        path="erase"
      />
      <ToolbarIconBtn
        title={messages.toolbar.undoDrawing}
        disabled={!canUndo}
        onClick={onUndo}
        path="undo"
      />
      <ToolbarIconBtn
        title={messages.toolbar.redoDrawing}
        disabled={!canRedo}
        onClick={onRedo}
        path="redo"
      />
      <ToolbarIconBtn title={messages.toolbar.clearRoundDrawings} onClick={onClear} path="clear" />
      <ToolbarIconBtn title={messages.toolbar.resetView} onClick={onResetView} path="reset" />
      {onSnapshot ? (
        <ToolbarIconBtn
          title={messages.toolbar.snapshotPlaybook}
          onClick={onSnapshot}
          path="snapshot"
        />
      ) : null}
      <ColorPalette paletteId={paletteId} color={color} onPalette={onPalette} onColor={onColor} />
      <ToolbarIconBtn
        title={messages.toolbar.trackPlayer}
        on={follow}
        disabled={!canFollow}
        onClick={() => onFollow(!follow)}
        path="track"
      />
      <ToolbarIconBtn
        title={messages.toolbar.trail}
        on={trails}
        onClick={() => onTrails(!trails)}
        path="trail"
      />
      <ToolbarIconBtn
        title={messages.toolbar.momentHint}
        on={moment}
        onClick={() => onMoment(!moment)}
        path="moment"
      />
      {hasFloors && (
        <span className="floor-picks">
          {floors.map((id) => (
            <button
              key={id}
              type="button"
              className={floorMode === id ? "on" : ""}
              onClick={() => onFloorMode(id)}
            >
              {floorLabel(messages, id)}
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
        {messages.preferences.layerGrenades}
      </button>
      <button type="button" className={layers.shots ? "on" : ""} onClick={() => toggle("shots")}>
        {messages.preferences.layerShots}
      </button>
      <button type="button" className={layers.deaths ? "on" : ""} onClick={() => toggle("deaths")}>
        {messages.preferences.layerDeaths}
      </button>
      <button
        type="button"
        className={layers.openings ? "on" : ""}
        onClick={() => toggle("openings")}
      >
        {messages.preferences.layerOpenings}
      </button>
      <button type="button" className={layers.names ? "on" : ""} onClick={() => toggle("names")}>
        {messages.preferences.layerNames}
      </button>
      <button type="button" className={layers.cone ? "on" : ""} onClick={() => toggle("cone")}>
        {messages.preferences.layerCone}
      </button>
      <button
        type="button"
        className={layers.heatmap ? "on" : ""}
        onClick={() => toggle("heatmap")}
      >
        {messages.preferences.layerHeatmap}
      </button>
      <button
        type="button"
        className={layers.summary ? "on" : ""}
        onClick={() => toggle("summary")}
      >
        {messages.preferences.layerSummary}
      </button>
    </div>
  );
}
