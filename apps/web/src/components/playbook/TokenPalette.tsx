import type { PlaybookTool } from "@/lib/playbook/pieces";
import { DRAW_TOOLS, PALETTE_TOKENS, paletteAriaLabel } from "@/lib/playbook/pieces";

interface Props {
  tool: PlaybookTool;
  onTool: (tool: PlaybookTool) => void;
}

export function TokenPalette({ tool, onTool }: Props) {
  return (
    <div className="playbook-toolbar map-toolbar" role="toolbar" aria-label="Playbook tools">
      <button
        type="button"
        className={tool === "pan" ? "on" : undefined}
        aria-pressed={tool === "pan"}
        aria-label="Pan"
        onClick={() => onTool("pan")}
      >
        Pan
      </button>
      {DRAW_TOOLS.map((row) => (
        <button
          key={row.tool}
          type="button"
          className={tool === row.tool ? "on" : undefined}
          aria-pressed={tool === row.tool}
          aria-label={row.label}
          onClick={() => onTool(row.tool)}
        >
          {row.label}
        </button>
      ))}
      {PALETTE_TOKENS.map((row) => (
        <button
          key={row.tool}
          type="button"
          className={tool === row.tool ? "on" : undefined}
          aria-pressed={tool === row.tool}
          aria-label={paletteAriaLabel(row)}
          onClick={() => onTool(row.tool)}
        >
          {row.label}
        </button>
      ))}
    </div>
  );
}
