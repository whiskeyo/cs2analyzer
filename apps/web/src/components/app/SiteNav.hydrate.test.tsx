import { afterEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { App } from "@/components/app/App";
import { renderApp } from "@/lib/app/renderApp";
import { normalizePath } from "@/lib/app/routes";

/**
 * Prerender locations have no trailing slash. Directory indexes and Apache
 * DirectorySlash serve the same HTML at `/analyzer/`. `NavLink end` treated
 * those as different pages, so the active class and `aria-current` diverged.
 */
const ROUTES = ["/analyzer", "/analyzer/", "/faq", "/faq/", "/playbook", "/playbook/"] as const;

describe("SiteNav hydration", () => {
  let reactRoot: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (reactRoot) {
      act(() => {
        reactRoot?.unmount();
      });
      reactRoot = null;
    }
    host?.remove();
    host = null;
    window.history.replaceState({}, "", "/");
  });

  it.each(ROUTES)("keeps the current-page link stable for %s", async (pathname) => {
    const html = renderToString(renderApp(normalizePath(pathname)));
    window.history.replaceState({}, "", pathname);
    const node = document.createElement("div");
    node.innerHTML = html;
    document.body.appendChild(node);
    host = node;

    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    };
    try {
      await act(async () => {
        reactRoot = hydrateRoot(node, <App />, {
          onRecoverableError(error) {
            errors.push(error instanceof Error ? error.message : String(error));
          },
        });
      });
    } finally {
      console.error = originalError;
    }

    expect(errors).toEqual([]);
    expect(consoleErrors.filter((line) => /hydrat/i.test(line))).toEqual([]);
    const current = node.querySelector("a.site-nav-link.is-active");
    expect(current).not.toBeNull();
    expect(current).toHaveAttribute("aria-current", "page");
  });
});
