import type { ReactNode } from "react";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
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
}

const TOOL_PATHS: Record<"pan" | PlaybookDrawTool, string> = {
  pan: "M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5 10 3.5M8 14.5 6 12.5M8 14.5 10 12.5M1.5 8 3.5 6M1.5 8 3.5 10M14.5 8 12.5 6M14.5 8 12.5 10",
  pen: "M11 2.5 13.5 5 6 12.5H3.5V10Z M8.5 5 11 7.5",
  arrow: "M3 13 13 3M8 3h5v5",
  text: "M3.5 3.5h9M8 3.5V13M5 13h6",
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
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
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

function ToolBtn({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={on ? "icon-btn on" : "icon-btn"}
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TokenPalette({ tool, onTool }: Props) {
  return (
    <div className="playbook-toolbar map-toolbar" role="toolbar" aria-label="Playbook tools">
      <ToolBtn label="Pan" on={tool === "pan"} onClick={() => onTool("pan")}>
        <ToolGlyph d={TOOL_PATHS.pan} />
      </ToolBtn>
      {DRAW_TOOLS.map((row) => (
        <ToolBtn
          key={row.tool}
          label={row.label}
          on={tool === row.tool}
          onClick={() => onTool(row.tool)}
        >
          <ToolGlyph d={TOOL_PATHS[row.tool]} />
        </ToolBtn>
      ))}
      <span className="toolbar-sep" />
      {PALETTE_TOKENS.map((row) => (
        <ToolBtn
          key={row.tool}
          label={paletteAriaLabel(row)}
          on={tool === row.tool}
          onClick={() => onTool(row.tool)}
        >
          {tokenGlyph(row)}
        </ToolBtn>
      ))}
    </div>
  );
}
