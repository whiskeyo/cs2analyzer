import { lazy, Suspense, useEffect } from "react";
import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { isAnalyzerPath, isFaqPath, isLayoutsPath, isPlaybookPath } from "@/lib/app/routes";
import { usePathname } from "@/lib/app/devNavigate";
import { Header } from "@/components/app/Header";
import { Analyzer } from "@/pages/Analyzer";
import { Home } from "@/pages/Home";
import { Playbook } from "@/pages/Playbook";

const Faq = lazy(() => import("@/pages/Faq").then((m) => ({ default: m.Faq })));

const LayoutsApp = import.meta.env.DEV
  ? lazy(() => import("@/components/layouts/LayoutsApp").then((m) => ({ default: m.LayoutsApp })))
  : null;

function pageTitle(pathname: string): string {
  if (isFaqPath(pathname)) return "FAQ · CS2 Analyzer";
  if (isAnalyzerPath(pathname)) return "Analyzer · CS2 Analyzer";
  if (isPlaybookPath(pathname)) return "Playbook · CS2 Analyzer";
  if (import.meta.env.DEV && isLayoutsPath(pathname)) return "Layouts · CS2 Analyzer";
  return "CS2 Analyzer";
}

function AppLayout() {
  const { session } = useApp();
  const pathname = usePathname();
  const onFaq = isFaqPath(pathname);
  const onAnalyzer = isAnalyzerPath(pathname);
  const onPlaybook = isPlaybookPath(pathname);
  const showLayouts = import.meta.env.DEV && isLayoutsPath(pathname) && LayoutsApp != null;
  const fillBoard = onPlaybook || (onAnalyzer && session.replay != null);

  useEffect(() => {
    document.title = pageTitle(pathname);
    const root = document.querySelector(".app");
    if (root) root.scrollTop = 0;
  }, [pathname]);

  if (showLayouts) {
    return (
      <div className="app layouts-app">
        <Header />
        <Suspense fallback={<div className="boot-error muted">Loading layouts editor…</div>}>
          <LayoutsApp />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={fillBoard ? "app" : "app splash"}>
      <Header />
      {onFaq ? (
        <Suspense fallback={<div className="boot-error muted">Loading FAQ…</div>}>
          <Faq />
        </Suspense>
      ) : onPlaybook ? (
        <Playbook />
      ) : onAnalyzer ? (
        <Analyzer />
      ) : (
        <Home />
      )}
    </div>
  );
}

/** `createWorker` is injectable so tests can drive the app without WASM. */
export function App({ createWorker }: { createWorker?: CreateWorker } = {}) {
  return (
    <AppStateProvider createWorker={createWorker}>
      <AppLayout />
    </AppStateProvider>
  );
}
