import { ToolbarIconBtn } from "@/components/map/ToolbarIcon";
import type { LayoutFloor } from "@/lib/layouts/types";
import type { LayoutTool } from "@/lib/layouts/useLayoutPointer";

interface Props {
  tool: LayoutTool;
  floor: LayoutFloor;
  hasFloors: boolean;
  onTool: (tool: LayoutTool) => void;
  onFloor: (floor: LayoutFloor) => void;
  onResetView: () => void;
}

export function LayoutToolbar({ tool, floor, hasFloors, onTool, onFloor, onResetView }: Props) {
  return (
    <div className="map-toolbar" role="toolbar" aria-label="Layout tools">
      <ToolbarIconBtn
        title="Pan (1)"
        on={tool === "pan"}
        onClick={() => onTool("pan")}
        path="pan"
      />
      <ToolbarIconBtn
        title="Polygon (2) — click vertices, Enter closes"
        on={tool === "polygon"}
        onClick={() => onTool("polygon")}
        path="polygon"
      />
      <ToolbarIconBtn
        title="Rect (3) — drag"
        on={tool === "rect"}
        onClick={() => onTool("rect")}
        path="rect"
      />
      <ToolbarIconBtn
        title="Circle (4) — drag"
        on={tool === "circle"}
        onClick={() => onTool("circle")}
        path="circle"
      />
      <ToolbarIconBtn
        title="Select (5)"
        on={tool === "select"}
        onClick={() => onTool("select")}
        path="select"
      />
      <ToolbarIconBtn title="Reset view (R)" onClick={onResetView} path="reset" />
      {hasFloors && (
        <span className="floor-picks">
          <button
            type="button"
            className={floor === "default" ? "on" : undefined}
            onClick={() => onFloor("default")}
          >
            Upper
          </button>
          <button
            type="button"
            className={floor === "lower" ? "on" : undefined}
            onClick={() => onFloor("lower")}
          >
            Lower
          </button>
        </span>
      )}
    </div>
  );
}
