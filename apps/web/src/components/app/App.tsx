import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { isAnalyzerPath, isFaqPath, isLayoutsPath, isPlaybookPath, ROUTES } from "@/lib/app/routes";
import { AppBackdrop } from "@/components/app/AppBackdrop";
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
  const { pathname } = useLocation();
  const onAnalyzer = isAnalyzerPath(pathname);
  const onPlaybook = isPlaybookPath(pathname);
  const showLayouts = import.meta.env.DEV && isLayoutsPath(pathname);
  const fillBoard = onPlaybook || (onAnalyzer && session.replay != null);

  useEffect(() => {
    document.title = pageTitle(pathname);
    const root = document.querySelector(".app");
    if (root) root.scrollTop = 0;
  }, [pathname]);

  const shellClass = showLayouts ? "app layouts-app" : fillBoard ? "app" : "app splash";

  return (
    <div className={shellClass}>
      <AppBackdrop />
      <Header />
      <Outlet />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path={ROUTES.analyzer.slice(1)} element={<Analyzer />} />
        <Route path={ROUTES.playbook.slice(1)} element={<Playbook />} />
        <Route
          path={ROUTES.faq.slice(1)}
          element={
            <Suspense fallback={<div className="boot-error muted">Loading FAQ…</div>}>
              <Faq />
            </Suspense>
          }
        />
        {import.meta.env.DEV && LayoutsApp != null ? (
          <Route
            path={ROUTES.layouts.slice(1)}
            element={
              <Suspense fallback={<div className="boot-error muted">Loading layouts editor…</div>}>
                <LayoutsApp />
              </Suspense>
            }
          />
        ) : null}
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}

/** `createWorker` is injectable so tests can drive the app without WASM. */
export function App({ createWorker }: { createWorker?: CreateWorker } = {}) {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStateProvider createWorker={createWorker}>
        <AppRoutes />
      </AppStateProvider>
    </BrowserRouter>
  );
}
