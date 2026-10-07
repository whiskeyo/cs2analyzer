import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "@/components/app/App";
import {
  PRERENDER_PATH_ATTR,
  hydrateAction,
  prerenderRedirectPath,
} from "@/lib/app/hydrateDocument";
import { canonicalLocation } from "@/lib/app/routes";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Decide against the URL the server actually used. Collapsing a trailing slash
// first would hide home HTML served at `/tutorial/` and turn the directory
// redirect into a loop. `404.html` is stamped `/404` and still hydrates.
const { pathname, search, hash } = window.location;
const action = hydrateAction(
  root.getAttribute(PRERENDER_PATH_ATTR),
  pathname,
  root.hasChildNodes(),
);

if (action === "redirect") {
  window.location.replace(`${prerenderRedirectPath(pathname)}${search}${hash}`);
} else {
  // Apache serves /route and /route/ as the same prerender (DirectorySlash Off).
  // Collapse the slash before hydrate so the client tree matches that slashless HTML.
  const canonical = canonicalLocation(pathname, search, hash);
  if (canonical !== `${pathname}${search}${hash}`) {
    window.history.replaceState(window.history.state, "", canonical);
  }
  if (action === "hydrate") {
    hydrateRoot(root, tree);
  } else {
    root.replaceChildren();
    createRoot(root).render(tree);
  }
}
