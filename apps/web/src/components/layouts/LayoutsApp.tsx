import "@/styles/layouts-editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/validate/json.ts";
import { CalloutPanel } from "@/components/layouts/CalloutPanel";
import { LayoutCanvas } from "@/components/layouts/LayoutCanvas";
import { LayoutToolbar } from "@/components/layouts/LayoutToolbar";
import { loadLayoutFile, saveLayoutFile } from "@/lib/layouts/api";
import {
  emptyLayout,
  formatLayout,
  layoutWithCallouts,
  moveCallout,
  removeCalloutRegion,
  renameLayoutGroup,
  nudgeLayoutGroup,
} from "@/lib/layouts/layout";
import { parseLayoutText, triggerLayoutDownload } from "@/lib/layouts/layoutIo";
import { dissolveSmallGroups } from "@/lib/layouts/groups";
import { loadCalibrations } from "@/lib/layouts/maps";
import { useLayoutHotkeys } from "@/lib/layouts/useLayoutHotkeys";
import type {
  LayoutCallout,
  LayoutDraft,
  LayoutFloor,
  MapCalibration,
  MapLayout,
  Point,
} from "@/lib/layouts/types";
import {
  LAYOUTS_SIDEBAR_DEFAULT_WIDTH,
  LAYOUTS_SIDEBAR_MAX_WIDTH,
  LAYOUTS_SIDEBAR_MIN_WIDTH,
  LAYOUTS_SIDEBAR_WIDTH_STORAGE_KEY,
} from "@/lib/shared/constants";
import { useLayoutPointer, type LayoutTool, type PanView } from "@/lib/layouts/useLayoutPointer";
import { usePanelResize } from "@/lib/shared/usePanelResize";

export function LayoutsApp() {
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
  const { width: panelWidth, handleProps: panelResize } = usePanelResize({
    storageKey: LAYOUTS_SIDEBAR_WIDTH_STORAGE_KEY,
    minWidth: LAYOUTS_SIDEBAR_MIN_WIDTH,
    maxWidth: LAYOUTS_SIDEBAR_MAX_WIDTH,
    defaultWidth: LAYOUTS_SIDEBAR_DEFAULT_WIDTH,
    stageSelector: ".layouts-stage",
    label: "Resize layouts panel",
  });

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

  const deleteCallouts = useCallback(
    (ids: string[]) => {
      const drop = new Set(ids);
      if (drop.size === 0) return;
      const next = dissolveSmallGroups(layoutRef.current.callouts.filter((c) => !drop.has(c.id)));
      replaceLayout(layoutWithCallouts(layoutRef.current, next));
      setSelectedIds((cur) => cur.filter((id) => !drop.has(id)));
    },
    [replaceLayout],
  );

  const pickTool = useCallback((next: LayoutTool) => {
    draftRef.current = null;
    setTool(next);
  }, []);

  const saveToFolder = useCallback(async () => {
    try {
      const path = await saveLayoutFile(layoutRef.current);
      const text = formatLayout(layoutRef.current);
      setSavedJson(text);
      setJsonText(text);
      setSaveNote(`Wrote ${path}`);
      setJsonError(null);
    } catch (err: unknown) {
      setSaveNote(errorMessage(err) || "save failed");
    }
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  useLayoutHotkeys({
    closeDraft,
    cancelDraft,
    save: () => void saveToFolder(),
    selectedIdsRef,
    layoutRef,
    onCallouts,
    clearSelection,
    deleteCallouts,
    pickTool,
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
        setLoadError(errorMessage(err) || "failed to load maps");
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
        if (!cancelled) {
          setLoadError(errorMessage(err) || "failed to load layout");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

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

  function download() {
    const text = formatLayout(layoutRef.current);
    triggerLayoutDownload(mapId, text);
    setSavedJson(text);
    setJsonText(text);
    setSaveNote(`Downloaded ${mapId}.json — usually Save to folder is enough`);
    setJsonError(null);
  }

  function applyJson() {
    const parsed = parseLayoutText(jsonText);
    if (!parsed.ok) {
      setJsonError("JSON must be schema 1 with map and callouts[]");
      return;
    }
    parsed.layout.map = mapId;
    replaceLayout(parsed.layout);
  }

  function importFile(file: File) {
    void file.text().then((text) => {
      const parsed = parseLayoutText(text);
      if (!parsed.ok) {
        setJsonError(
          parsed.reason === "json"
            ? "Could not parse that JSON file"
            : "That file is not a schema 1 layout",
        );
        return;
      }
      parsed.layout.map = mapId;
      replaceLayout(parsed.layout);
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
        <p className="muted">Run npm run dev so the editor can load maps from public/maps.</p>
      </div>
    );
  }
  if (!maps || !cal) {
    return <div className="boot-error muted">Loading maps…</div>;
  }

  return (
    <div className="layouts-app">
      <div className="main layouts-stage">
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
          mapIds={mapIds}
          mapId={mapId}
          onMapChange={changeMap}
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
          onRemoveRegion={(id, index) => {
            replaceLayout(
              layoutWithCallouts(
                layoutRef.current,
                removeCalloutRegion(layoutRef.current.callouts, id, index),
              ),
            );
          }}
          onJsonText={(text) => {
            setJsonText(text);
            setJsonError(null);
          }}
          onApplyJson={applyJson}
          onSave={saveToFolder}
          onDownload={download}
          onImportFile={importFile}
          width={panelWidth}
          resizeHandle={panelResize}
        />
      </div>
    </div>
  );
}
