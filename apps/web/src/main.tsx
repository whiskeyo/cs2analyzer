import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "@/components/app/App";
import {
  PRERENDER_PATH_ATTR,
  hydrateAction,
  prerenderRedirectPath,
} from "@/lib/app/hydrateDocument";
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

const action = hydrateAction(
  root.getAttribute(PRERENDER_PATH_ATTR),
  window.location.pathname,
  root.hasChildNodes(),
);

if (action === "redirect") {
  const { search, hash } = window.location;
  window.location.replace(`${prerenderRedirectPath(window.location.pathname)}${search}${hash}`);
} else if (action === "hydrate") {
  hydrateRoot(root, tree);
} else {
  root.replaceChildren();
  createRoot(root).render(tree);
}
