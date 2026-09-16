import { useLocation } from "react-router";
import { normalizePath } from "./routes";

/**
 * Soft navigation for callers outside a hook (tests, SnapshotDialog fallback).
 * Prefer `useNavigate` / `<NavLink>` inside React.
 */
export function navigate(path: string): void {
  if (normalizePath(window.location.pathname) === normalizePath(path)) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathname(): string {
  return useLocation().pathname;
}

export {
  isAnalyzerPath,
  isContactPath,
  isFaqPath,
  isHomePath,
  isLayoutsPath,
  isPlaybookPath,
  isRatingPath,
  normalizePath,
  ROUTES,
} from "./routes";
