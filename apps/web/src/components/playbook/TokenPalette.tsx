import { ColorPalette } from "@/components/notes/ColorPalette";
import type { ReactNode } from "react";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import type { NadeStyle } from "@/lib/notes/types";
import {
  DRAW_TOOLS,
  GRENADE_PIECE_KINDS,
  PALETTE_TOKENS,
  paletteAriaLabel,
  type PaletteToken,
  type PlaybookDrawTool,
  type PlaybookTool,
} from "@/lib/playbook/pieces";
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
}

const TOOL_PATHS: Record<"pan" | PlaybookDrawTool, string> = {
  pan: "M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5 10 3.5M8 14.5 6 12.5M8 14.5 10 12.5M1.5 8 3.5 6M1.5 8 3.5 10M14.5 8 12.5 6M14.5 8 12.5 10",
  pen: "M11 2.5 13.5 5 6 12.5H3.5V10Z M8.5 5 11 7.5",
  arrow: "M3 13 13 3M8 3h5v5",
  eraser: "M4.5 11.5 10 6l2.5 2.5-5.5 5.5H4.5v-2.5Z M6.5 13.5h6",
};

function ToolGlyph({ d }: { d: string }) {
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

const EXTRA_PATHS = {
  undo: "M5 5 2 8l3 3M2 8h7.5a3.5 3.5 0 1 1 0 7",
  redo: "M11 5 14 8l-3 3M14 8H6.5a3.5 3.5 0 1 0 0 7",
  reset: "M3 8a5 5 0 1 0 1.5-3.5M3 3v3h3",
};

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
}: Props) {
  return (
    <div className="playbook-toolbar map-toolbar" role="toolbar" aria-label="Playbook tools">
      <ToolBtn label="Pan" title="Pan (V)" on={tool === "pan"} onClick={() => onTool("pan")}>
        <ToolGlyph d={TOOL_PATHS.pan} />
      </ToolBtn>
      {DRAW_TOOLS.map((row) => (
        <ToolBtn
          key={row.tool}
          label={row.label}
          title={`${row.label} (${row.tool === "pen" ? "D" : row.tool === "arrow" ? "A" : "E"})`}
          on={tool === row.tool}
          onClick={() => onTool(row.tool)}
        >
          <ToolGlyph d={TOOL_PATHS[row.tool]} />
        </ToolBtn>
      ))}
      <span className="toolbar-sep" />
      <ToolBtn
        label="Undo drawing (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <ToolGlyph d={EXTRA_PATHS.undo} />
      </ToolBtn>
      <ToolBtn
        label="Redo drawing (Ctrl+Y)"
        title="Redo (Ctrl+Y)"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <ToolGlyph d={EXTRA_PATHS.redo} />
      </ToolBtn>
      <ToolBtn label="Reset view" title="Reset view (R)" onClick={onResetView}>
        <ToolGlyph d={EXTRA_PATHS.reset} />
      </ToolBtn>
      <ColorPalette paletteId={paletteId} color={color} onPalette={onPalette} onColor={onColor} />
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
        <ToolGlyph d="M2 13c3-1 4-7 6-7s2 4 6 1M8 6.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4" />
      </ToolBtn>
      <ToolBtn
        label="Nade icon"
        title="Nade icon (G)"
        on={nadeStyle === "icon"}
        onClick={() => onNadeStyle("icon")}
      >
        <ToolGlyph d="M4 3.5h8v9H4Z M8 3.5v9" />
      </ToolBtn>
      <ToolBtn
        label="Nade effect"
        title="Nade effect (G)"
        on={nadeStyle === "effect"}
        onClick={() => onNadeStyle("effect")}
      >
        <ToolGlyph d="M8 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
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
    default:
      return "";
  }
}
