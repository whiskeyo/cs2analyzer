import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { downloadBlob } from "@/lib/shared/download";
import { publicUrl } from "@/lib/shared/publicUrl";
import { computeStats, exportStatsCsv } from "@/lib/stats/stats";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView } from "@/lib/parse/seriesMode";
import { prettyMap } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";

function downloadCsv(replay: Replay, fileName: string, tick: number) {
  const csv = exportStatsCsv(replay, computeStats(replay, tick), tick);
  const base = fileName.replace(/\.dem$/i, "") || "demo";
  downloadBlob(`${base}-stats.csv`, "text/csv", csv);
}

export function ViewerHeader() {
  const { session, playback, review, habits, onFiles } = useApp();
  const replay = session.replay;
  if (!replay) return null;

  const aggregated = isAggregatedView(session.series, habits);

  return (
    <header className="top">
      <button type="button" className="ghost" onClick={session.close}>
        New demo
      </button>
      <div className="brand">
        <img className="brand-mark" src={publicUrl("favicon.svg")} width={28} height={28} alt="" />
        <h1>CS2 Analyzer</h1>
      </div>
      <span className="file-meta">
        {prettyMap(replay.header.map_name)}
        {session.fileName ? ` · ${session.fileName}` : ""} · {replay.kills.length} kills ·{" "}
        {replay.grenades.length} nades
      </span>
      <button type="button" className="ghost" onClick={() => void review.exportNotes()}>
        Export notes
      </button>
      <ImportNotesButton onFile={(file) => onFiles([file])} />
      <button
        type="button"
        className="ghost"
        disabled={aggregated}
        title={aggregated ? "Export CSV is per-demo; switch off Aggregated" : undefined}
        onClick={() => downloadCsv(replay, session.fileName, playback.tick)}
      >
        Export CSV
      </button>
    </header>
  );
}
