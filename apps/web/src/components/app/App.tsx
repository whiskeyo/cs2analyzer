import { AppStateProvider, useApp } from "@/lib/state/appState";
import type { CreateWorker } from "@/lib/parse/useDemoSession";
import { Header } from "./Header";
import { Splash } from "./Splash";
import { Viewer } from "./Viewer";

function Shell() {
  const { session } = useApp();
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
