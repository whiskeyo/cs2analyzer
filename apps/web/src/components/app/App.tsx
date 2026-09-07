import { lazy, Suspense, useEffect } from "react";
import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { isAnalyzerPath, isFaqPath, isLayoutsPath } from "@/lib/app/routes";
import { usePathname } from "@/lib/app/devNavigate";
import { Header } from "@/components/app/Header";
import { Viewer } from "@/components/app/Viewer";
import { Analyzer } from "@/pages/Analyzer";
import { Faq } from "@/pages/Faq";
import { Home } from "@/pages/Home";

const LayoutsApp = import.meta.env.DEV
  ? lazy(() => import("@/components/layouts/LayoutsApp").then((m) => ({ default: m.LayoutsApp })))
  : null;

function pageTitle(pathname: string): string {
  if (isFaqPath(pathname)) return "FAQ · CS2 Analyzer";
  if (isAnalyzerPath(pathname)) return "Analyzer · CS2 Analyzer";
  if (import.meta.env.DEV && isLayoutsPath(pathname)) return "Layouts · CS2 Analyzer";
  return "CS2 Analyzer";
}

function Shell() {
  const { session } = useApp();
  const pathname = usePathname();
  const onFaq = isFaqPath(pathname);
  const onAnalyzer = isAnalyzerPath(pathname);
  const showLayouts = import.meta.env.DEV && isLayoutsPath(pathname) && LayoutsApp != null;
  const showViewer = session.replay != null && !onFaq && !showLayouts;

  useEffect(() => {
    document.title = pageTitle(pathname);
    const root = document.querySelector(".app");
    if (root) root.scrollTop = 0;
  }, [pathname]);

  if (showLayouts) {
    return (
      <div className="app layouts-shell">
        <Header />
        <Suspense fallback={<div className="boot-error muted">Loading layouts editor…</div>}>
          <LayoutsApp />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={showViewer ? "app" : "app splash"}>
      <Header />
      {onFaq ? <Faq /> : showViewer ? <Viewer /> : onAnalyzer ? <Analyzer /> : <Home />}
    </div>
  );
}

/** `createWorker` is injectable so tests can drive the app without WASM. */
export function App({ createWorker }: { createWorker?: CreateWorker } = {}) {
  return (
    <AppStateProvider createWorker={createWorker}>
      <Shell />
    </AppStateProvider>
  );
}
