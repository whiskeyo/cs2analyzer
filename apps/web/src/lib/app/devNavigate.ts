import { useEffect, useState } from "react";
import { normalizePath } from "./routes";

/** Soft client navigation (no react-router). */
export function navigate(path: string): void {
  if (normalizePath(window.location.pathname) === normalizePath(path)) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return path;
}

export {
  isAnalyzerPath,
  isFaqPath,
  isHomePath,
  isLayoutsPath,
  normalizePath,
  ROUTES,
} from "./routes";
