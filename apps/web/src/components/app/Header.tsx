import { useMatchPdfExport } from "@/lib/export/useMatchPdfExport";
import { downloadBlob } from "@/lib/shared/download";
import { publicUrl } from "@/lib/shared/publicUrl";
import { computeStats, exportStatsCsv, matchEndTick } from "@/lib/stats/stats";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView } from "@/lib/parse/seriesMode";
import { prettyMap } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";
import { useNavigate } from "react-router";
import { ROUTES, usePathname } from "@/lib/app/devNavigate";
import {
  isContactPath,
  isFaqPath,
  isLayoutsPath,
  isPlaybookPath,
  isRatingPath,
} from "@/lib/app/routes";
import { isTutorialPlaybookPath } from "@/lib/tutorial/query";
import { AddDemoControl } from "./AddDemoControl";
import { SettingsMenu } from "./SettingsMenu";
import { SiteNav } from "./SiteNav";

function downloadCsv(replay: Replay, fileName: string) {
  const csv = exportStatsCsv(replay, computeStats(replay, matchEndTick(replay)));
  const base = fileName.replace(/\.dem$/i, "") || "demo";
  downloadBlob(`${base}-stats.csv`, "text/csv", csv);
}

/** Shared top bar: brand, nav, match chrome, and the settings gear. */
export function Header() {
  const { session, habits } = useApp();
  const matchPdf = useMatchPdfExport();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);

  const navigate = useNavigate();
  const pathname = usePathname();
  const onLayouts = import.meta.env.DEV && isLayoutsPath(pathname);
  const onFaq = isFaqPath(pathname);
  const onRating = isRatingPath(pathname);
  const onContact = isContactPath(pathname);
  const onPlaybook = isPlaybookPath(pathname) || isTutorialPlaybookPath(pathname);
  const showMatchChrome =
    replay != null && !onFaq && !onRating && !onContact && !onLayouts && !onPlaybook;

  return (
    <header className="top">
      <div className="brand-row">
        <button
          type="button"
          className="brand"
          onClick={() => {
            session.close();
            navigate(ROUTES.home);
          }}
          aria-label="Home"
        >
          <img
            className="brand-mark"
            src={publicUrl("favicon.svg")}
            width={28}
            height={28}
            alt=""
          />
          <h1>CS2 Analyzer</h1>
        </button>
        <SiteNav />
        <span className="pre-release" tabIndex={0}>
          [pre-release testing]
          <span className="pre-release-tip" role="tooltip">
            Changes may not be backward compatible. Notes saved in this browser might stop working
            after newer versions.
          </span>
        </span>
        {onLayouts ? (
          <span className="dev-badge" title="Development-only tool; not shipped in production">
            [dev]
          </span>
        ) : null}
      </div>
      <div className="top-center">
        {onLayouts ? (
          <span className="file-meta">Callout Layout Editor</span>
        ) : replay && showMatchChrome ? (
          <span className="file-meta">
            {prettyMap(replay.header.map_name)}
            {session.fileName ? ` · ${session.fileName}` : ""} · {replay.kills.length} kills ·{" "}
            {replay.grenades.length} nades
          </span>
        ) : null}
      </div>
      <div className="top-actions">
        {replay && showMatchChrome ? <AddDemoControl /> : null}
        {replay && showMatchChrome ? (
          <button type="button" className="ghost" onClick={session.close}>
            New demo
          </button>
        ) : null}
        {replay && showMatchChrome ? (
          <button
            type="button"
            className="ghost"
            disabled={aggregated}
            title={aggregated ? "Export CSV is per-demo; switch off Aggregated" : undefined}
            onClick={() => downloadCsv(replay, session.fileName)}
          >
            Export CSV
          </button>
        ) : null}
        {replay && showMatchChrome ? (
          <button
            type="button"
            className="ghost"
            disabled={!matchPdf.canExport || matchPdf.busy}
            title={
              matchPdf.aggregated
                ? "Export PDF is per-demo; switch off Aggregated"
                : (matchPdf.error ?? undefined)
            }
            onClick={() => void matchPdf.exportPdf()}
          >
            {matchPdf.busy ? "Exporting…" : "Export PDF"}
          </button>
        ) : null}
        <SettingsMenu />
      </div>
    </header>
  );
}
