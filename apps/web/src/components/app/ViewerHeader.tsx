import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { publicUrl } from "@/lib/shared/publicUrl";
import { computeStats, exportStatsCsv } from "@/lib/stats/stats";
import { useApp } from "@/lib/state/appState";
import { prettyMap } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";

function downloadCsv(replay: Replay, fileName: string, tick: number) {
  const csv = exportStatsCsv(replay, computeStats(replay, tick), tick);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${fileName.replace(/\.dem$/i, "") || "demo"}-stats.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ViewerHeader() {
  const { session, playback, review, onFile } = useApp();
  const replay = session.replay;
  if (!replay) return null;

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
      <ImportNotesButton onFile={onFile} />
      <button
        type="button"
        className="ghost"
        onClick={() => downloadCsv(replay, session.fileName, playback.tick)}
      >
        Export CSV
      </button>
    </header>
  );
}
