import { lazy, Suspense } from "react";
import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { usePathname } from "@/lib/app/devNavigate";
import { Header } from "./Header";
import { Splash } from "./Splash";
import { Viewer } from "./Viewer";

const LayoutsApp = import.meta.env.DEV
  ? lazy(() => import("@/components/layouts/LayoutsApp").then((m) => ({ default: m.LayoutsApp })))
  : null;

function Shell() {
  const { session } = useApp();
  const pathname = usePathname();
  const showLayouts = import.meta.env.DEV && pathname === "/layouts" && LayoutsApp != null;

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
    <div className={session.replay ? "app" : "app splash"}>
      <Header />
      {session.replay ? <Viewer /> : <Splash />}
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
