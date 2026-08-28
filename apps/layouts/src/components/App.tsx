import { useCallback, useEffect, useRef, useState } from "react";
import { CalloutPanel } from "@/components/CalloutPanel";
import { LayoutCanvas } from "@/components/LayoutCanvas";
import { LayoutToolbar } from "@/components/LayoutToolbar";
import { loadLayoutFile, saveLayoutFile } from "@/lib/api";
import {
  emptyLayout,
  formatLayout,
  layoutWithCallouts,
  moveCallout,
  parseMapLayout,
  renameLayoutGroup,
  nudgeLayoutGroup,
} from "@/lib/layout";
import {
  dissolveSmallGroups,
  canGroupIds,
  canUngroupIds,
  groupCallouts,
  ungroupCallouts,
} from "@/lib/groups";
import { loadCalibrations } from "@/lib/maps";
import type {
  LayoutCallout,
  LayoutDraft,
  LayoutFloor,
  MapCalibration,
  MapLayout,
  Point,
} from "@/lib/types";
import { useLayoutPointer, type LayoutTool, type PanView } from "@/lib/useLayoutPointer";

function typingInField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export function App() {
  const [maps, setMaps] = useState<Record<string, MapCalibration> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapId, setMapId] = useState("de_mirage");
  const [floor, setFloor] = useState<LayoutFloor>("default");
  const [tool, setTool] = useState<LayoutTool>("polygon");
  const [layout, setLayout] = useState<MapLayout>(() => emptyLayout("de_mirage"));
  const [savedJson, setSavedJson] = useState(() => formatLayout(emptyLayout("de_mirage")));
  const [jsonText, setJsonText] = useState(() => formatLayout(emptyLayout("de_mirage")));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef<PanView>({
    scale: 1,
    ox: 0,
    oy: 0,
    panning: false,
    dragged: false,
    lx: 0,
    ly: 0,
  });
  const draftRef = useRef<LayoutDraft | null>(null);
  const cursorRef = useRef<Point | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const floorRef = useRef(floor);
  floorRef.current = floor;
  const calloutsRef = useRef(layout.callouts);
  calloutsRef.current = layout.callouts;
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dirty = formatLayout(layout) !== savedJson;

  const replaceLayout = useCallback((next: MapLayout) => {
    setLayout(next);
    setJsonText(formatLayout(next));
    setJsonError(null);
  }, []);

  const onCallouts = useCallback(
    (callouts: LayoutCallout[]) => {
      replaceLayout(layoutWithCallouts(layoutRef.current, callouts));
    },
    [replaceLayout],
  );

  const selectCallout = useCallback((id: string | null, additive = false) => {
    if (!id) {
      if (!additive) setSelectedIds([]);
      return;
    }
    if (additive) {
      setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
      return;
    }
    setSelectedIds([id]);
  }, []);

  const { closeDraft, cancelDraft, onMouseDown, onDoubleClick, onWheel, onContextMenu } =
    useLayoutPointer({
      wrapRef,
      view,
      toolRef,
      floorRef,
      calloutsRef,
      selectedIdRef,
      draftRef,
      cursorRef,
      onCallouts,
      onSelect: selectCallout,
    });

  useEffect(() => {
    loadCalibrations()
      .then((next) => {
        setMaps(next);
        const ids = Object.keys(next).sort();
        const initial = ids.includes("de_mirage") ? "de_mirage" : (ids[0] ?? "de_mirage");
        setMapId(initial);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "failed to load maps");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLayoutFile(mapId)
      .then((next) => {
        if (cancelled) return;
        view.current = { scale: 1, ox: 0, oy: 0, panning: false, dragged: false, lx: 0, ly: 0 };
        draftRef.current = null;
        setFloor("default");
        setSelectedIds([]);
        setLayout(next);
        const text = formatLayout(next);
        setSavedJson(text);
        setJsonText(text);
        setJsonError(null);
        setSaveNote(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "failed to load layout");
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveToFolder();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typingInField()) return;
      if (e.key === "Enter") {
        e.preventDefault();
        closeDraft();
      }
      if (e.key === "Escape") {
        cancelDraft();
        setSelectedIds([]);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        deleteCallouts(selectedIdsRef.current);
      }
      if (e.key.toLowerCase() === "g") {
        const ids = selectedIdsRef.current;
        if (canGroupIds(layoutRef.current.callouts, ids)) {
          e.preventDefault();
          onCallouts(groupCallouts(layoutRef.current.callouts, ids));
          setSelectedIds([]);
        }
        return;
      }
      if (e.key.toLowerCase() === "u") {
        const ids = selectedIdsRef.current;
        if (canUngroupIds(layoutRef.current.callouts, ids)) {
          e.preventDefault();
          onCallouts(ungroupCallouts(layoutRef.current.callouts, ids));
          setSelectedIds([]);
        }
        return;
      }
      if (e.key === "1") pickTool("pan");
      if (e.key === "2") pickTool("polygon");
      if (e.key === "3") pickTool("rect");
      if (e.key === "4") pickTool("circle");
      if (e.key === "5") pickTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read refs
  }, [closeDraft, cancelDraft]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const cal = maps?.[mapId];
  const mapIds = maps ? Object.keys(maps).sort() : [];

  function deleteCallouts(ids: string[]) {
    const drop = new Set(ids);
    if (drop.size === 0) return;
    const next = dissolveSmallGroups(layoutRef.current.callouts.filter((c) => !drop.has(c.id)));
    replaceLayout(layoutWithCallouts(layoutRef.current, next));
    setSelectedIds((cur) => cur.filter((id) => !drop.has(id)));
  }

  function renameCallout(id: string, name: string) {
    if (name.length === 0) return;
    replaceLayout(
      layoutWithCallouts(
        layoutRef.current,
        layoutRef.current.callouts.map((c) => (c.id === id ? { ...c, name } : c)),
      ),
    );
  }

  function nudgeCallout(id: string, delta: -1 | 1) {
    const from = layoutRef.current.callouts.findIndex((c) => c.id === id);
    if (from < 0) return;
    replaceLayout(
      layoutWithCallouts(
        layoutRef.current,
        moveCallout(layoutRef.current.callouts, from, from + delta),
      ),
    );
  }

  function renameLayoutGroupName(fromId: string, name: string) {
    replaceLayout(renameLayoutGroup(layoutRef.current, fromId, name));
  }

  function nudgeGroup(id: string, delta: -1 | 1) {
    replaceLayout(nudgeLayoutGroup(layoutRef.current, id, delta));
  }

  function pickTool(next: LayoutTool) {
    draftRef.current = null;
    setTool(next);
  }

  async function saveToFolder() {
    try {
      const path = await saveLayoutFile(layoutRef.current);
      const text = formatLayout(layoutRef.current);
      setSavedJson(text);
      setJsonText(text);
      setSaveNote(`Wrote ${path}`);
      setJsonError(null);
    } catch (err) {
      setSaveNote(err instanceof Error ? err.message : "save failed");
    }
  }

  function download() {
    const text = formatLayout(layoutRef.current);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mapId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedJson(text);
    setJsonText(text);
    setSaveNote(`Downloaded ${mapId}.json — usually Save to folder is enough`);
    setJsonError(null);
  }

  function applyJson() {
    const parsed = parseMapLayout(JSON.parse(jsonText) as unknown);
    if (!parsed) {
      setJsonError("JSON must be schema 1 with map and callouts[]");
      return;
    }
    parsed.map = mapId;
    replaceLayout(parsed);
  }

  function importFile(file: File) {
    void file.text().then((text) => {
      try {
        const parsed = parseMapLayout(JSON.parse(text) as unknown);
        if (!parsed) {
          setJsonError("That file is not a schema 1 layout");
          return;
        }
        parsed.map = mapId;
        replaceLayout(parsed);
      } catch {
        setJsonError("Could not parse that JSON file");
      }
    });
  }

  function changeMap(next: string) {
    if (next === mapId) return;
    if (dirty && !window.confirm("Discard unsaved callouts on this map?")) return;
    setMapId(next);
  }

  if (loadError) {
    return (
      <div className="boot-error">
        <p>{loadError}</p>
        <p className="muted">Run this app with npm run dev so it can see apps/web/public/maps.</p>
      </div>
    );
  }
  if (!maps || !cal) {
    return <div className="boot-error muted">Loading maps…</div>;
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" width={28} height={28} alt="" />
          <h1>CS2 Analyzer - callout layout editor</h1>
        </div>
        <label>
          Map
          <select value={mapId} onChange={(e) => changeMap(e.target.value)}>
            {mapIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="main">
        <div className="radar-col">
          <LayoutToolbar
            tool={tool}
            floor={floor}
            hasFloors={Boolean(cal.lower_radar)}
            onTool={pickTool}
            onFloor={(next) => {
              draftRef.current = null;
              setFloor(next);
            }}
            onResetView={() => {
              view.current.scale = 1;
              view.current.ox = 0;
              view.current.oy = 0;
            }}
          />
          <LayoutCanvas
            cal={cal}
            floor={floor}
            tool={tool}
            callouts={layout.callouts}
            selectedIds={selectedIds}
            wrapRef={wrapRef}
            view={view}
            draftRef={draftRef}
            cursorRef={cursorRef}
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
            onContextMenu={onContextMenu}
          />
        </div>
        <CalloutPanel
          layout={layout}
          selectedIds={selectedIds}
          jsonText={jsonText}
          jsonError={jsonError}
          dirty={dirty}
          saveNote={saveNote}
          onSelectedIds={setSelectedIds}
          onCallouts={onCallouts}
          onRename={renameCallout}
          onRenameGroup={renameLayoutGroupName}
          onNudge={nudgeCallout}
          onNudgeGroup={nudgeGroup}
          onDelete={deleteCallouts}
          onJsonText={(text) => {
            setJsonText(text);
            setJsonError(null);
          }}
          onApplyJson={() => {
            try {
              applyJson();
            } catch {
              setJsonError("Could not parse JSON");
            }
          }}
          onSave={saveToFolder}
          onDownload={download}
          onImportFile={importFile}
        />
      </div>
    </div>
  );
}
