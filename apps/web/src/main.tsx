import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "@/components/app/App";
import { canonicalLocation } from "@/lib/app/routes";
import "./index.css";

// Apache serves /route and /route/ as the same prerender (no 301). Collapse the
// slash before hydrate so the client tree matches that slashless HTML.
const { pathname, search, hash } = window.location;
const canonical = canonicalLocation(pathname, search, hash);
if (canonical !== `${pathname}${search}${hash}`) {
  window.history.replaceState(window.history.state, "", canonical);
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root.hasChildNodes()) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
