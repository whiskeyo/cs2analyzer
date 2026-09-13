import { ToolbarIcon } from "@/components/map/ToolbarIcon";
import { TOOLBAR_PATHS } from "@/components/map/toolbarPaths";
import { ColorPalette } from "@/components/notes/ColorPalette";
import type { ReactNode } from "react";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import type { FloorMode, NadeStyle } from "@/lib/notes/types";
import {
  DRAW_TOOLS,
  GRENADE_PIECE_KINDS,
  PALETTE_TOKENS,
  paletteAriaLabel,
  type PaletteToken,
  type PlaybookDrawTool,
  type PlaybookTool,
} from "@/lib/playbook/pieces";
import {
  PLAYBOOK_IMAGE_PIN_FRAME,
  PLAYBOOK_IMAGE_PIN_LAND,
  PLAYBOOK_IMAGE_PIN_SKY,
  PLAYBOOK_IMAGE_PIN_STROKE,
  PLAYBOOK_IMAGE_PIN_SUN,
} from "@/lib/playbook/images";
import { YOUTUBE_PLAY, YOUTUBE_RED } from "@/lib/playbook/videos";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";

interface Props {
  tool: PlaybookTool;
  onTool: (tool: PlaybookTool) => void;
  nadeTrail: boolean;
  onNadeTrail: (on: boolean) => void;
  nadeStyle: NadeStyle;
  onNadeStyle: (style: NadeStyle) => void;
  paletteId: string;
  color: string;
  onPalette: (id: string) => void;
  onColor: (color: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetView: () => void;
  floorMode?: FloorMode;
  hasFloors?: boolean;
  onFloorMode?: (mode: FloorMode) => void;
}

const TOOL_PATHS: Record<"pan" | PlaybookDrawTool, string> = {
  pan: TOOLBAR_PATHS.pan,
  pen: TOOLBAR_PATHS.pen,
  arrow: TOOLBAR_PATHS.arrow,
  eraser: TOOLBAR_PATHS.erase,
};

function PawnGlyph({ color }: { color: string }) {
  return (
    <svg className="playbook-pawn-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.5 8 3.5 12.5 6 8 3.5 3.5Z"
        fill={color}
        stroke="#0b0e12"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function tokenGlyph(token: PaletteToken) {
  if (token.tool === "pawn-ct") return <PawnGlyph color={CT_COLOR} />;
  if (token.tool === "pawn-t") return <PawnGlyph color={T_COLOR} />;
  if (token.tool === "bomb") {
    return (
      <span aria-hidden="true">
        <WeaponIcon weapon="planted_c4" />
      </span>
    );
  }
  if (token.tool === "youtube") {
    return (
      <svg className="playbook-youtube-icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1" y="3.5" width="14" height="9" rx="2.2" fill={YOUTUBE_RED} />
        <path d="M7 6.2 11 8 7 9.8Z" fill={YOUTUBE_PLAY} />
      </svg>
    );
  }
  if (token.tool === "image") {
    return (
      <svg className="playbook-image-icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect
          x="1"
          y="2.5"
          width="14"
          height="11"
          rx="1.4"
          fill={PLAYBOOK_IMAGE_PIN_FRAME}
          stroke={PLAYBOOK_IMAGE_PIN_STROKE}
          strokeWidth="1.2"
        />
        <rect x="2.4" y="3.8" width="11.2" height="8.4" fill={PLAYBOOK_IMAGE_PIN_SKY} />
        <circle cx="11.2" cy="6" r="1.35" fill={PLAYBOOK_IMAGE_PIN_SUN} />
        <path d="M2.4 12.2 6.2 7.4 8.4 9.6 13.6 6.2 13.6 12.2Z" fill={PLAYBOOK_IMAGE_PIN_LAND} />
      </svg>
    );
  }
  if ((GRENADE_PIECE_KINDS as readonly string[]).includes(token.tool)) {
    const kind = token.tool as (typeof GRENADE_PIECE_KINDS)[number];
    return (
      <span aria-hidden="true">
        <WeaponIcon weapon={NADE_WEAPON[kind]} />
      </span>
    );
  }
  return token.label;
}

function ToolBtn({
  label,
  title,
  on,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={on ? "icon-btn on" : "icon-btn"}
      title={title ?? label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TokenPalette({
  tool,
  onTool,
  nadeTrail,
  onNadeTrail,
  nadeStyle,
  onNadeStyle,
  paletteId,
  color,
  onPalette,
  onColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetView,
  floorMode = "auto",
  hasFloors = false,
  onFloorMode,
}: Props) {
  return (
    <div className="playbook-toolbar map-toolbar" role="toolbar" aria-label="Playbook tools">
      <ToolBtn label="Pan" title="Pan (V)" on={tool === "pan"} onClick={() => onTool("pan")}>
        <ToolbarIcon d={TOOL_PATHS.pan} />
      </ToolBtn>
      {DRAW_TOOLS.map((row) => (
        <ToolBtn
          key={row.tool}
          label={row.label}
          title={`${row.label} (${row.tool === "pen" ? "D" : row.tool === "arrow" ? "A" : "E"})`}
          on={tool === row.tool}
          onClick={() => onTool(row.tool)}
        >
          <ToolbarIcon d={TOOL_PATHS[row.tool]} />
        </ToolBtn>
      ))}
      <span className="toolbar-sep" />
      <ToolBtn
        label="Undo drawing (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.undo} />
      </ToolBtn>
      <ToolBtn
        label="Redo drawing (Ctrl+Y)"
        title="Redo (Ctrl+Y)"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.redo} />
      </ToolBtn>
      <ToolBtn label="Reset view" title="Reset view (R)" onClick={onResetView}>
        <ToolbarIcon d={TOOLBAR_PATHS.reset} />
      </ToolBtn>
      <ColorPalette paletteId={paletteId} color={color} onPalette={onPalette} onColor={onColor} />
      {hasFloors && onFloorMode ? (
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
      ) : null}
      <span className="toolbar-sep" />
      {PALETTE_TOKENS.map((row) => (
        <ToolBtn
          key={row.tool}
          label={paletteAriaLabel(row)}
          title={`${paletteAriaLabel(row)} (${tokenKey(row.tool)})`}
          on={tool === row.tool}
          onClick={() => onTool(row.tool)}
        >
          {tokenGlyph(row)}
        </ToolBtn>
      ))}
      <span className="toolbar-sep" />
      <ToolBtn
        label="Nade trail"
        title="Nade trail (N)"
        on={nadeTrail}
        onClick={() => onNadeTrail(!nadeTrail)}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.nadeTrail} />
      </ToolBtn>
      <ToolBtn
        label="Nade icon"
        title="Nade icon (G)"
        on={nadeStyle === "icon"}
        onClick={() => onNadeStyle("icon")}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.nadeIcon} />
      </ToolBtn>
      <ToolBtn
        label="Nade effect"
        title="Nade effect (G)"
        on={nadeStyle === "effect"}
        onClick={() => onNadeStyle("effect")}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.nadeEffect} />
      </ToolBtn>
    </div>
  );
}

function tokenKey(tool: PaletteToken["tool"]): string {
  switch (tool) {
    case "pawn-ct":
      return "Q";
    case "pawn-t":
      return "W";
    case "smoke":
      return "S";
    case "flash":
      return "F";
    case "he":
      return "H";
    case "molotov":
      return "M";
    case "incendiary":
      return "I";
    case "decoy":
      return "Y";
    case "bomb":
      return "B";
    case "youtube":
      return "U";
    case "image":
      return "P";
    default:
      return "";
  }
}
