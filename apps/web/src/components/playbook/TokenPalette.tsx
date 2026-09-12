import { ToolbarIcon } from "@/components/map/ToolbarIcon";
import { TOOLBAR_PATHS } from "@/components/map/toolbarPaths";
import { ColorPalette } from "@/components/notes/ColorPalette";
import type { ReactNode } from "react";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { floorLabel, useMessages, type Messages } from "@/lib/i18n";
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

const DRAW_TOOL_HOTKEY: Record<PlaybookDrawTool, string> = {
  pen: "D",
  arrow: "A",
  eraser: "E",
};

const FLOORS: FloorMode[] = ["auto", "upper", "lower"];

function drawToolLabel(messages: Messages, tool: PlaybookDrawTool): string {
  switch (tool) {
    case "pen":
      return messages.playbook.toolPen;
    case "arrow":
      return messages.playbook.toolArrow;
    case "eraser":
      return messages.playbook.toolEraser;
  }
}

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
  const { messages } = useMessages();
  return (
    <div
      className="playbook-toolbar map-toolbar"
      role="toolbar"
      aria-label={messages.playbook.toolsAria}
    >
      <ToolBtn
        label={messages.playbook.toolPan}
        title={`${messages.playbook.toolPan} (V)`}
        on={tool === "pan"}
        onClick={() => onTool("pan")}
      >
        <ToolbarIcon d={TOOL_PATHS.pan} />
      </ToolBtn>
      {DRAW_TOOLS.map((row) => {
        const label = drawToolLabel(messages, row.tool);
        return (
          <ToolBtn
            key={row.tool}
            label={label}
            title={`${label} (${DRAW_TOOL_HOTKEY[row.tool]})`}
            on={tool === row.tool}
            onClick={() => onTool(row.tool)}
          >
            <ToolbarIcon d={TOOL_PATHS[row.tool]} />
          </ToolBtn>
        );
      })}
      <span className="toolbar-sep" />
      <ToolBtn label={messages.playbook.toolUndo} disabled={!canUndo} onClick={onUndo}>
        <ToolbarIcon d={TOOLBAR_PATHS.undo} />
      </ToolBtn>
      <ToolBtn label={messages.playbook.toolRedo} disabled={!canRedo} onClick={onRedo}>
        <ToolbarIcon d={TOOLBAR_PATHS.redo} />
      </ToolBtn>
      <ToolBtn
        label={messages.playbook.toolResetView}
        title={`${messages.playbook.toolResetView} (R)`}
        onClick={onResetView}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.reset} />
      </ToolBtn>
      <ColorPalette paletteId={paletteId} color={color} onPalette={onPalette} onColor={onColor} />
      {hasFloors && onFloorMode ? (
        <span className="floor-picks">
          {FLOORS.map((id) => (
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
        label={messages.playbook.nadeTrail}
        title={`${messages.playbook.nadeTrail} (N)`}
        on={nadeTrail}
        onClick={() => onNadeTrail(!nadeTrail)}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.nadeTrail} />
      </ToolBtn>
      <ToolBtn
        label={messages.playbook.nadeIcon}
        title={`${messages.playbook.nadeIcon} (G)`}
        on={nadeStyle === "icon"}
        onClick={() => onNadeStyle("icon")}
      >
        <ToolbarIcon d={TOOLBAR_PATHS.nadeIcon} />
      </ToolBtn>
      <ToolBtn
        label={messages.playbook.nadeEffect}
        title={`${messages.playbook.nadeEffect} (G)`}
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
    default:
      return "";
  }
}
