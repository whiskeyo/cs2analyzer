import { COLOR_PRESETS } from "@/lib/notes/palettes";

interface Props {
  paletteId: string;
  color: string;
  onPalette: (id: string) => void;
  onColor: (color: string) => void;
}

export function ColorPalette({ paletteId, color, onPalette, onColor }: Props) {
  const preset = COLOR_PRESETS.find((row) => row.id === paletteId) ?? COLOR_PRESETS[0];
  return (
    <>
      <span className="palette-picks">
        {COLOR_PRESETS.map((row) => (
          <button
            key={row.id}
            type="button"
            className={row.id === preset.id ? "on" : ""}
            onClick={() => onPalette(row.id)}
            title={`${row.label} ([ ])`}
          >
            {row.label}
          </button>
        ))}
      </span>
      <span className="swatches">
        {(preset?.colors ?? []).map((swatch, index) => (
          <button
            key={swatch}
            type="button"
            className={`swatch${color === swatch ? " on" : ""}`}
            style={{ background: swatch }}
            onClick={() => onColor(swatch)}
            aria-label={swatch}
            title={`${swatch} (${index === 4 ? "0" : String(index + 6)})`}
          />
        ))}
      </span>
    </>
  );
}
