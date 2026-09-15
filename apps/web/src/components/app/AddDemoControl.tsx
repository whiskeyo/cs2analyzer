import { useRef } from "react";
import { prefetchParser } from "@/lib/parse/ensureParser";
import { takePickedDemoFiles } from "@/lib/parse/demoDrop";
import { loadedSessionCount } from "@/lib/parse/appendSeries";
import { demoFilePickerAvailable, pickOpenFiles } from "@/lib/notes/projectStore";
import { useApp } from "@/lib/state/appState";
import { useUserSettings } from "@/lib/settings/useUserSettings";

/** Header control: pick more GOTV files without restarting the open session. */
export function AddDemoControl() {
  const { session, appendFiles } = useApp();
  const { settings } = useUserSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const count = loadedSessionCount({
    demo: session.demo ?? null,
    series: session.series ?? null,
    parsedDemos: session.parsedDemos ?? [],
    mapGroups: session.mapGroups ?? [],
  });
  const atCap = count >= settings.seriesMaxFiles;
  const disabled = session.parsing || atCap;
  const title = atCap
    ? `Series supports at most ${settings.seriesMaxFiles} demos.`
    : session.parsing
      ? "Wait for the current parse to finish, or cancel it."
      : "Add another GOTV demo to this session";

  const pick = () => {
    if (disabled) return;
    if (demoFilePickerAvailable()) {
      void pickOpenFiles().then((picked) => {
        if (!picked) return;
        takePickedDemoFiles(picked.files, picked.handles, appendFiles);
      });
      return;
    }
    inputRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        className="ghost"
        disabled={disabled}
        title={title}
        onPointerEnter={() => prefetchParser()}
        onClick={pick}
      >
        Add demo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".dem,application/octet-stream"
        multiple
        hidden
        aria-label="Add demo files"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length > 0) appendFiles(files);
        }}
      />
    </>
  );
}
