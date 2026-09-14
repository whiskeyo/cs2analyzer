import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { applyPageMeta } from "@/lib/app/pageMeta";
import { isAnalyzerPath, isLayoutsPath, isPlaybookPath, ROUTES } from "@/lib/app/routes";
import { AppBackdrop } from "@/components/app/AppBackdrop";
import { Header } from "@/components/app/Header";
import { Analyzer } from "@/pages/Analyzer";
import { Contact } from "@/pages/Contact";
import { Faq } from "@/pages/Faq";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";
import { Playbook } from "@/pages/Playbook";

const LayoutsApp = import.meta.env.DEV
  ? lazy(() => import("@/components/layouts/LayoutsApp").then((m) => ({ default: m.LayoutsApp })))
  : null;

function AppLayout() {
  const { session, status } = useApp();
  const { pathname } = useLocation();
  const onAnalyzer = isAnalyzerPath(pathname);
  const onPlaybook = isPlaybookPath(pathname);
  const showLayouts = import.meta.env.DEV && isLayoutsPath(pathname);
  const fillBoard = onPlaybook || (onAnalyzer && session.replay != null);
  const showStorageError = onAnalyzer && session.replay != null && status.error != null;

  useEffect(() => {
    applyPageMeta(pathname);
    const root = document.querySelector(".app");
    if (root) root.scrollTop = 0;
  }, [pathname]);

  const shellClass = showLayouts ? "app layouts-app" : fillBoard ? "app" : "app splash";

  return (
    <div className={shellClass}>
      <AppBackdrop />
      <Header />
      {showStorageError ? (
        <p className="error status-banner" role="alert">
          {status.error}
        </p>
      ) : null}
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
        <Route path={ROUTES.faq.slice(1)} element={<Faq />} />
        <Route path={ROUTES.contact.slice(1)} element={<Contact />} />
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
        <Route path="*" element={<NotFound />} />
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
