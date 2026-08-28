import type { LayoutFloor } from "@/lib/types";
import type { LayoutTool } from "@/lib/useLayoutPointer";

interface Props {
  tool: LayoutTool;
  floor: LayoutFloor;
  hasFloors: boolean;
  onTool: (tool: LayoutTool) => void;
  onFloor: (floor: LayoutFloor) => void;
  onResetView: () => void;
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
  onClick,
  d,
}: {
  title: string;
  on?: boolean;
  onClick: () => void;
  d: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn${on ? " on" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <Icon d={d} />
    </button>
  );
}

const I = {
  pan: "M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5 10 3.5M8 14.5 6 12.5M8 14.5 10 12.5M1.5 8 3.5 6M1.5 8 3.5 10M14.5 8 12.5 6M14.5 8 12.5 10",
  polygon: "M2.5 11 5 3.5h6.5L14 9.5 8.5 14Z",
  rect: "M3.5 3.5h9v9h-9Z",
  circle: "M13 8A5 5 0 1 1 3 8a5 5 0 0 1 10 0Z",
  select: "M4 2.5v11l3.2-3.2 2.2 5.2 1.6-.7-2.2-5.2H13Z",
  reset: "M3 8a5 5 0 1 0 1.5-3.5M3 3v3h3",
};

export function LayoutToolbar({ tool, floor, hasFloors, onTool, onFloor, onResetView }: Props) {
  return (
    <div className="map-toolbar" role="toolbar" aria-label="Layout tools">
      <IconBtn title="Pan (1)" on={tool === "pan"} onClick={() => onTool("pan")} d={I.pan} />
      <IconBtn
        title="Polygon (2) — click vertices, Enter closes"
        on={tool === "polygon"}
        onClick={() => onTool("polygon")}
        d={I.polygon}
      />
      <IconBtn
        title="Rect (3) — drag"
        on={tool === "rect"}
        onClick={() => onTool("rect")}
        d={I.rect}
      />
      <IconBtn
        title="Circle (4) — drag"
        on={tool === "circle"}
        onClick={() => onTool("circle")}
        d={I.circle}
      />
      <IconBtn
        title="Select (5)"
        on={tool === "select"}
        onClick={() => onTool("select")}
        d={I.select}
      />
      <IconBtn title="Reset view" onClick={onResetView} d={I.reset} />
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
      <span className="hint">
        Double-click an edge · Ctrl+click multi-select · G group · U ungroup · Ctrl+S saves
      </span>
    </div>
  );
}
