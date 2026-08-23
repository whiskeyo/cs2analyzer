interface Props {
  onFile: (file: File) => void;
  parsing: boolean;
  progress: { current: number; total: number } | null;
  error: string | null;
}

export function DropZone({ onFile, parsing, progress, error }: Props) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((100 * progress.current) / progress.total))
      : 0;

  return (
    <label
      className="drop"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <input
        type="file"
        accept=".dem,application/octet-stream"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div className="drop-title">CS2 Analyzer</div>
      <p>
        Drop a Counter-Strike 2 <code>.dem</code> file here.
      </p>
      <p className="muted">Parsed entirely in your browser. Nothing is uploaded.</p>
      <ul className="feature-list">
        <li>Live radar, nades, tracking, and drawing</li>
        <li>Scoreboard, clutches, weapons, and round history</li>
        <li>Kill feed, bomb timer, heatmap, CSV export</li>
      </ul>
      {parsing && (
        <div className="progress">
          <div className="bar" style={{ width: `${pct}%` }} />
          <span>{pct}%</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </label>
  );
}
