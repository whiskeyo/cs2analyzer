import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "./faq";
import { JSON_LD_BREADCRUMB, JSON_LD_SOFTWARE, SITE_NAME, SITE_ORIGIN, pageMeta } from "./pageMeta";
import { injectPrerenderedPage, PRERENDER_PATHS, prerenderFilePath } from "./prerender";
import { ROUTES } from "./routes";

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title>CS2 Analyzer</title>
    <meta name="description" content="home description" />
    <link rel="canonical" href="${SITE_ORIGIN}/" />
    <meta property="og:title" content="CS2 Analyzer" />
    <meta property="og:url" content="${SITE_ORIGIN}/" />
    <meta name="twitter:title" content="CS2 Analyzer" />
    <script type="application/ld+json" data-seo="software-application">{"@type":"SoftwareApplication"}</script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

describe("PRERENDER_PATHS", () => {
  it("covers public marketing routes and skips the DEV layouts editor", () => {
    expect([...PRERENDER_PATHS]).toEqual([
      ROUTES.home,
      ROUTES.analyzer,
      ROUTES.playbook,
      ROUTES.faq,
      ROUTES.rating,
      ROUTES.contact,
    ]);
    expect(PRERENDER_PATHS).not.toContain(ROUTES.layouts);
    expect(prerenderFilePath("/")).toBe("index.html");
    expect(prerenderFilePath("/faq")).toBe("faq/index.html");
    expect(prerenderFilePath("/faq/")).toBe("faq/index.html");
    expect(prerenderFilePath("/analyzer")).toBe("analyzer/index.html");
  });
});

describe("injectPrerenderedPage", () => {
  it("stamps FAQ title, canonical, breadcrumbs, and body markup", () => {
    const html = injectPrerenderedPage(
      TEMPLATE,
      "/faq",
      "<h2>FAQ</h2><p>What is CS2 Analyzer?</p>",
    );
    const faq = pageMeta("/faq");
    expect(html).toContain("<title>CS2 Analyzer — FAQ</title>");
    expect(html).toContain(`content="${faq.description}"`);
    expect(html).toContain(`href="${SITE_ORIGIN}/faq"`);
    expect(html).toContain(`<div id="root"><h2>FAQ</h2><p>What is CS2 Analyzer?</p></div>`);
    expect(html).toContain(`data-seo="${JSON_LD_SOFTWARE}"`);
    expect(html).toContain(`data-seo="${JSON_LD_BREADCRUMB}"`);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain(`"${SITE_ORIGIN}/faq"`);
    expect(html).not.toMatch(/viewer/i);
    expect(html).not.toContain("/layouts");
  });

  it("keeps SoftwareApplication JSON-LD on home and omits breadcrumbs", () => {
    const html = injectPrerenderedPage(TEMPLATE, "/", `<h1>${SITE_NAME}</h1>`);
    expect(html).toContain(`<title>${SITE_NAME}</title>`);
    expect(html).toContain(`data-seo="${JSON_LD_SOFTWARE}"`);
    expect(html).toContain("SoftwareApplication");
    expect(html).not.toContain("BreadcrumbList");
    expect(html).not.toContain(`data-seo="${JSON_LD_BREADCRUMB}"`);
    expect(html).toContain(`<div id="root"><h1>${SITE_NAME}</h1></div>`);
  });

  it("throws when the template has no empty #root", () => {
    expect(() => injectPrerenderedPage("<html></html>", "/faq", "<p>x</p>")).toThrow(/#root/);
  });

  it("strips React 19 SSR image preloads so hydrateRoot sees the app shell", () => {
    const html = injectPrerenderedPage(
      TEMPLATE,
      "/",
      `<link rel="preload" as="image" href="/favicon.svg"/><h1>${SITE_NAME}</h1>`,
    );
    expect(html).toContain(`<div id="root"><h1>${SITE_NAME}</h1></div>`);
    expect(html).not.toContain('rel="preload"');
  });
});

describe("FAQ articles", () => {
  it("are markdown-backed questions the prerendered /faq page should include", () => {
    expect(FAQ_ITEMS.map((item) => item.question)).toContain("What is CS2 Analyzer?");
    expect(FAQ_ITEMS.length).toBeGreaterThan(1);
  });
});
