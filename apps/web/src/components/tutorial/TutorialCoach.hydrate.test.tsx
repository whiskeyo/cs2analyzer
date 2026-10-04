import { afterEach, describe, expect, it } from "vitest";
import { StrictMode } from "react";
import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { BrowserRouter, StaticRouter } from "react-router";
import { TutorialCoach } from "./TutorialCoach";

const PLAYABLE = [
  ["/tutorial/aggregated", "Switch CT and T"],
  ["/tutorial/single", "Press Play or drag the round timeline"],
  ["/tutorial/playbook", "The tree lists every map"],
] as const;

function Page() {
  return (
    <div>
      <TutorialCoach />
      <div className="home">Drop a demo</div>
    </div>
  );
}

function Tree({ kind, url }: { kind: "static" | "browser"; url: string }) {
  const page = <Page />;
  const routed =
    kind === "static" ? (
      <StaticRouter location={url}>{page}</StaticRouter>
    ) : (
      <BrowserRouter>{page}</BrowserRouter>
    );
  return <StrictMode>{routed}</StrictMode>;
}

describe("TutorialCoach hydration", () => {
  let reactRoot: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (reactRoot) {
      act(() => {
        reactRoot?.unmount();
      });
      reactRoot = null;
    }
    container?.remove();
    container = null;
    window.history.replaceState({}, "", "/");
  });

  async function hydrate(pathname: string, html: string) {
    window.history.replaceState({}, "", pathname);
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    container = host;
    const errors: string[] = [];
    await act(async () => {
      reactRoot = hydrateRoot(host, <Tree kind="browser" url={pathname} />, {
        onRecoverableError(error) {
          errors.push(error instanceof Error ? error.message : String(error));
        },
      });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return errors;
  }

  it.each(PLAYABLE)(
    "prerenders %s without the coach, then shows it after hydrate",
    async (pathname, copy) => {
      const html = renderToString(<Tree kind="static" url={pathname} />);
      expect(html).toContain("Drop a demo");
      expect(html).not.toContain("tutorial-coach");
      expect(html).not.toContain(copy);

      const errors = await hydrate(pathname, html);
      expect(errors).toEqual([]);
      expect(container?.textContent).toContain("Drop a demo");
      expect(document.querySelector(".tutorial-coach")?.textContent).toContain(copy);
    },
  );

  it("does not mount a coach on the tutorial hub", async () => {
    const html = renderToString(<Tree kind="static" url="/tutorial" />);
    expect(html).not.toContain("tutorial-coach");
    const errors = await hydrate("/tutorial", html);
    expect(errors).toEqual([]);
    expect(document.querySelector(".tutorial-coach")).toBeNull();
  });
});
