import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface StatsTimelinePanel {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const CLOSED: StatsTimelinePanel = {
  open: false,
  toggle: () => {},
  close: () => {},
};

const StatsTimelinePanelContext = createContext<StatsTimelinePanel>(CLOSED);

/** Shares the stats-timeline dialog between the map toolbar and the viewer. */
export function StatsTimelinePanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return (
    <StatsTimelinePanelContext.Provider value={value}>
      {children}
    </StatsTimelinePanelContext.Provider>
  );
}

export function useStatsTimelinePanel(): StatsTimelinePanel {
  return useContext(StatsTimelinePanelContext);
}
