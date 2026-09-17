import { StrictMode } from "react";
import { StaticRouter } from "react-router";
import { AppShell } from "@/components/app/App";

/** SSR tree for a public path. Client hydrates the same shell via `BrowserRouter`. */
export function renderApp(url: string) {
  return (
    <StrictMode>
      <StaticRouter basename={import.meta.env.BASE_URL} location={url}>
        <AppShell />
      </StaticRouter>
    </StrictMode>
  );
}
