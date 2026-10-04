# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""Apache/.htaccess routing matrix for cs2analyzer.

Usage:
  uv run apps/web/scripts/htaccess_check.py https://cs2analyzer.whiskeyo.pl
  uv run apps/web/scripts/htaccess_check.py http://127.0.0.1:18088 --expect-rev <sha>
  uv run apps/web/scripts/htaccess_check.py URL --expect-rev <sha> --cache-bust <sha>
  uv run apps/web/scripts/htaccess_check.py URL --expect baseline   # describe, never fail
  uv run apps/web/scripts/htaccess_check.py URL --allow-slash-redirect

Known routes come from apps/web/src/lib/app/prerender.ts (not a hardcoded list).

Default expectations (the fix):
  * known routes, with and without trailing slash: 200, text/html, canonical == route
    (no redirect; with --allow-slash-redirect a single 301 to the slash form is OK)
  * unknown URLs: 404 AND our NotFound page (title "Page not found" / .not-found / noindex)
  * /404.html itself is that page (own canonical, noindex), not a copy of /
  * real assets: 200 with the right content-type; missing /assets/*: 404, never 200
  * /.htaccess: 403 or 404; / and index.html send Cache-Control: no-cache
  * --expect-rev: X-Htaccess-Rev on cache-busted /, a route, a 404, and the wasm
  * --cache-bust TOKEN: append cb=TOKEN to every request (?cb= or &cb=) so a CDN
    cannot answer the smoke with a cached pre-deploy response
Exit code 1 if any expectation fails.
"""

from __future__ import annotations

import argparse
import re
import sys
import uuid
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit

import httpx

UNKNOWN = [
    "/nie-ma-takiej",
    "/nie-ma-takiej/",
    "/demo/xyz/abc",
    "/foo.php",
    "/analyzer/xyz",
    "/tutorial/nope",
    "/nope.html",
    "/maps/nope.png",
    "/%E2%9C%93-unicode",
    "/index.php/foo",
    "/analyzer/index.html/x",
]

REPO = Path(__file__).resolve().parents[3]


def load_prerender_paths() -> list[str]:
    """Evaluate PRERENDER_PATHS from the route config the build already uses."""
    routes_src = (REPO / "apps/web/src/lib/app/routes.ts").read_text(encoding="utf-8")
    prerender_src = (REPO / "apps/web/src/lib/app/prerender.ts").read_text(encoding="utf-8")
    route_map = dict(re.findall(r"^\s*(\w+):\s*\"([^\"]+)\"", routes_src, re.M))
    block = re.search(r"PRERENDER_PATHS\s*=\s*\[(.*?)\]\s*as\s+const", prerender_src, re.S)
    if not block:
        raise SystemExit("PRERENDER_PATHS not found in prerender.ts")
    paths: list[str] = []
    for raw in block.group(1).split(","):
        item = raw.split("//", 1)[0].strip()
        if not item:
            continue
        direct = re.fullmatch(r"ROUTES\.(\w+)", item)
        if direct:
            key = direct.group(1)
            if key not in route_map:
                raise SystemExit(f"PRERENDER_PATHS references unknown ROUTES.{key}")
            paths.append(route_map[key])
            continue
        nested = re.fullmatch(r"`\$\{ROUTES\.(\w+)\}/([A-Za-z0-9_-]+)`", item)
        if nested:
            key = nested.group(1)
            if key not in route_map:
                raise SystemExit(f"PRERENDER_PATHS references unknown ROUTES.{key}")
            paths.append(f"{route_map[key]}/{nested.group(2)}")
            continue
        literal = re.fullmatch(r"\"([^\"]+)\"", item)
        if literal:
            paths.append(literal.group(1))
            continue
        raise SystemExit(f"cannot parse prerender path entry: {item}")
    if "/" not in paths or "/faq" not in paths:
        raise SystemExit(f"unexpected prerender paths: {paths}")
    return paths


def classify(body: str, ctype: str) -> str:
    low = body[:20000].lower()
    if "text/html" not in ctype and not low.lstrip().startswith("<!doctype html"):
        return f"non-html ({len(body)}B)"
    if "<title>index of" in low:
        return "DIR-LISTING"
    if "<title>404 not found</title>" in low:
        return "apache-404"
    if "<title>403 forbidden</title>" in low:
        return "apache-403"
    if "ovhcloud" in low and "blocked" in low:
        return "ovh-waf-block"
    if "ovh" in low and ("cs2 analyzer" not in low):
        return "ovh-default"
    is404 = (
        "page not found" in low
        or 'class="not-found"' in low
        or "this page does not exist" in low
    )
    canon = re.search(r'<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"', body, re.I)
    title = re.search(r"<title>([^<]*)", body, re.I)
    c = urlsplit(canon.group(1)).path if canon else "-"
    t = title.group(1).strip() if title else "-"
    if is404:
        return f"OUR-404 (title={t!r}, canonical={c})"
    if c == "/" or (c == "-" and t == "CS2 Analyzer"):
        return f"home (title={t!r}, canonical={c})"
    return f"page canonical={c} title={t!r}"


def bust_path(path: str, token: str | None) -> str:
    """Append cb=TOKEN without dropping a query the path already has."""
    if not token:
        return path
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}cb={quote(token, safe='')}"


def fetch(
    client: httpx.Client,
    base: str,
    path: str,
    max_hops: int = 5,
    cache_bust: str | None = None,
):
    url = base + bust_path(path, cache_bust)
    chain = []
    for _ in range(max_hops):
        response = client.get(url)
        chain.append(response)
        if response.status_code in (301, 302, 303, 307, 308) and "location" in response.headers:
            nxt = urljoin(url, response.headers["location"])
            if nxt == url or nxt in [str(item.request.url) for item in chain[:-1]]:
                chain.append(None)
                break
            url = nxt
            continue
        break
    return chain


def canon_path(body: str) -> str | None:
    match = re.search(r'<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"', body, re.I)
    return urlsplit(match.group(1)).path.rstrip("/") or "/" if match else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("--expect", choices=["fix", "baseline"], default="fix")
    parser.add_argument("--allow-slash-redirect", action="store_true")
    parser.add_argument("--md", help="also write the table as markdown to this file")
    parser.add_argument(
        "--expect-rev",
        help="expected X-Htaccess-Rev (prefix match, e.g. short sha); "
        "checked on cache-busted requests for /, a route, an unknown 404 and the wasm",
    )
    parser.add_argument("--wasm", help="override the real wasm path (default: discovered via JS)")
    parser.add_argument(
        "--cache-bust",
        metavar="TOKEN",
        help="append cb=TOKEN to every request so a CDN cannot reuse a cached response",
    )
    args = parser.parse_args()
    base = args.base.rstrip("/")
    cache_bust = args.cache_bust
    prerender_paths = load_prerender_paths()
    routes = [path for path in prerender_paths if path != "/"]
    client = httpx.Client(
        follow_redirects=False,
        timeout=20,
        headers={"User-Agent": "cs2a-qa-htaccess/1"},
    )

    def get(path: str, headers: dict[str, str] | None = None) -> httpx.Response:
        return client.get(base + bust_path(path, cache_bust), headers=headers)

    home = get("/")
    assets = sorted(set(re.findall(r'(/assets/[^"\']+\.(?:js|css))', home.text)))
    seen: set[str] = set()
    queue = [item for item in assets if item.endswith(".js")]
    wasm = args.wasm
    while queue and not wasm and len(seen) < 40:
        js = queue.pop(0)
        if js in seen:
            continue
        seen.add(js)
        src = get(js).text
        for match in re.findall(r'([A-Za-z0-9_.-]+\.(?:wasm|js))["\'`]', src):
            if "-" not in match:
                continue
            found = "/assets/" + match
            if match.endswith(".wasm"):
                wasm = found
                break
            if found not in seen:
                queue.append(found)
    if not wasm:
        print("WARN: real .wasm not discovered; pass --wasm /assets/<name>.wasm", file=sys.stderr)
    rows: list[tuple] = []
    fails = 0

    def check(group: str, path: str, ok_fn, why: str) -> None:
        nonlocal fails
        chain = fetch(client, base, path, cache_bust=cache_bust)
        loop = chain[-1] is None
        chain = [item for item in chain if item is not None]
        first, last = chain[0], chain[-1]
        ctype = last.headers.get("content-type", "")
        if "html" in ctype or not ctype:
            what = classify(last.text, ctype)
        else:
            what = f"{ctype.split(';')[0]} {len(last.content)}B"
        hops = " -> ".join(str(item.status_code) for item in chain)
        loc = first.headers.get("location", "")
        ok = (not loop) and ok_fn(chain, last, ctype)
        verdict = "info" if args.expect == "baseline" else ("PASS" if ok else "FAIL")
        if verdict == "FAIL":
            fails += 1
        edge = f"{last.headers.get('server', '-')}/{last.headers.get('cf-cache-status', '-')}"
        rev = last.headers.get("x-htaccess-rev", "-")
        rows.append(
            (
                verdict,
                group,
                path,
                hops + (" LOOP" if loop else ""),
                loc,
                ctype,
                what,
                edge,
                rev,
                why,
            )
        )

    def no_redirect(chain) -> bool:
        return len(chain) == 1

    query_paths = []
    if "/analyzer" in routes:
        query_paths = ["/analyzer?x=1", "/analyzer/?demo=a%2Fb"]
    for path in ["/"] + [form for route in routes for form in (route, route + "/")] + query_paths:
        route = path.split("?")[0].rstrip("/") or "/"

        def ok(chain, last, ctype, route=route, path=path):
            if not (
                len(chain) == 1
                or (
                    args.allow_slash_redirect
                    and len(chain) == 2
                    and chain[0].status_code == 301
                    and not path.endswith("/")
                )
            ):
                return False
            return (
                last.status_code == 200
                and "text/html" in ctype
                and canon_path(last.text) == route
                and "not-found" not in last.text
            )

        check("route", path, ok, "200 html, canonical=route, no redirect")

    def ok404(chain, last, ctype):
        body = last.text.lower()
        return (
            no_redirect(chain)
            and last.status_code == 404
            and "text/html" in ctype
            and (
                "page not found" in body
                or 'class="not-found"' in body
                or "this page does not exist" in body
            )
            and "noindex" in body
        )

    for path in UNKNOWN:
        check("unknown", path, ok404, "404 + our 404 page (noindex), no redirect")

    def ok_missing_asset(chain, last, ctype):
        # Status is what dynamic import() / WebAssembly fetch use. Our 404 HTML is OK; 200 is not.
        return no_redirect(chain) and last.status_code == 404

    for path in [
        "/assets/nope.js",
        "/assets/nope.css",
        "/assets/index-deadbeef.js",
        "/assets/parser-deadbeef.wasm",
        "/assets/cs2analyzer_wasm_bg-deadbeef.wasm",
    ]:
        check(
            "missing-asset",
            path,
            ok_missing_asset,
            "404 status (body may be our 404 page), never 200 HTML",
        )

    types = {".js": "javascript", ".css": "text/css", ".wasm": "application/wasm"}
    if not wasm and args.expect == "fix":
        fails += 1
        rows.append(
            (
                "FAIL",
                "asset",
                "(real .wasm)",
                "-",
                "",
                "",
                "not discovered",
                "-",
                "-",
                "200 application/wasm",
            )
        )
    for path in assets + ([wasm] if wasm else []):
        expected = types[path[path.rfind(".") :]]
        check(
            "asset",
            path,
            lambda chain, last, ctype, expected=expected: no_redirect(chain)
            and last.status_code == 200
            and expected in ctype,
            f"200 {expected}",
        )

    def ok_cache(chain, last, ctype):
        return (
            no_redirect(chain)
            and last.status_code == 200
            and "no-cache" in last.headers.get("cache-control", "")
        )

    check("static", "/", ok_cache, "Cache-Control contains no-cache")
    check(
        "static",
        "/robots.txt",
        lambda chain, last, ctype: last.status_code == 200 and "text/plain" in ctype,
        "200 text/plain",
    )
    check(
        "static",
        "/sitemap.xml",
        lambda chain, last, ctype: last.status_code == 200 and "xml" in ctype,
        "200 xml",
    )
    check(
        "static",
        "/favicon.ico",
        lambda chain, last, ctype: last.status_code == 200 and "html" not in ctype,
        "200 non-html",
    )
    check(
        "static",
        "/index.html",
        lambda chain, last, ctype: last.status_code in (200, 301) and "html" in ctype,
        "200 (or 301 to /)",
    )

    def ok_404_file(chain, last, ctype):
        body = last.text.lower()
        canon = canon_path(last.text)
        return (
            no_redirect(chain)
            and last.status_code == 200
            and "text/html" in ctype
            and ("page not found" in body or 'class="not-found"' in body)
            and canon != "/"
            and "noindex" in body
        )

    check("static", "/404.html", ok_404_file, "200 our 404 page, noindex, canonical is not /")
    check(
        "dotfile",
        "/.htaccess",
        lambda chain, last, ctype: last.status_code in (403, 404),
        "403/404",
    )
    check(
        "dotfile",
        "/.git/config",
        lambda chain, last, ctype: last.status_code in (403, 404) and "[core]" not in last.text,
        "403/404",
    )
    check(
        "dir",
        "/assets/",
        lambda chain, last, ctype: "index of" not in last.text.lower()[:2000],
        "no directory listing",
    )
    check(
        "dir",
        "/maps/",
        lambda chain, last, ctype: "index of" not in last.text.lower()[:2000],
        "no directory listing",
    )

    if args.expect_rev:
        for path in ["/", "/analyzer/", "/analyzer", "/nie-ma-takiej"] + ([wasm] if wasm else []):
            response = get(
                f"{path}?qa-nocache={uuid.uuid4().hex}",
                headers={"Cache-Control": "no-cache"},
            )
            got = response.headers.get("x-htaccess-rev", "")
            ok = bool(got) and (got.startswith(args.expect_rev) or args.expect_rev.startswith(got))
            if not ok and args.expect != "baseline":
                fails += 1
            verdict = "info" if args.expect == "baseline" else ("PASS" if ok else "FAIL")
            rows.append(
                (
                    verdict,
                    "rev",
                    path + "?qa-nocache",
                    str(response.status_code),
                    response.headers.get("location", ""),
                    response.headers.get("content-type", ""),
                    "",
                    f"{response.headers.get('server', '-')}/{response.headers.get('cf-cache-status', '-')}",
                    got or "MISSING",
                    f"X-Htaccess-Rev ~ {args.expect_rev} (needs Header always set for 404)",
                )
            )

    header = [
        "verdict",
        "group",
        "path",
        "status chain",
        "Location",
        "Content-Type",
        "body",
        "server/cf-cache",
        "X-Htaccess-Rev",
        "expectation",
    ]
    widths = [max(len(str(row[i])) for row in rows + [tuple(header)]) for i in range(len(header))]
    widths = [min(width, 60) for width in widths]
    print(
        f"base={base}  index cache-control={home.headers.get('cache-control', '-')!r}  "
        f"server={home.headers.get('server', '-')}"
    )
    print("  ".join(name.ljust(widths[i]) for i, name in enumerate(header)))
    for row in rows:
        print("  ".join(str(cell)[:60].ljust(widths[i]) for i, cell in enumerate(row)))
    if args.md:
        with open(args.md, "w", encoding="utf-8") as handle:
            handle.write(
                f"base: `{base}`, index Cache-Control: `{home.headers.get('cache-control', '-')}`\n\n"
            )
            handle.write("| " + " | ".join(header) + " |\n|" + "---|" * len(header) + "\n")
            for row in rows:
                handle.write("| " + " | ".join(str(cell).replace("|", "\\|") or "-" for cell in row) + " |\n")
    if args.expect == "fix":
        print(f"\n{fails} FAIL / {len(rows)} checks")
        return 1 if fails else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
