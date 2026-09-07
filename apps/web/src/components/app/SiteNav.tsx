import { navigate, ROUTES, usePathname } from "@/lib/app/devNavigate";
import { normalizePath } from "@/lib/app/routes";

const LINKS = [
  { to: ROUTES.analyzer, label: "Analyzer" },
  { to: ROUTES.playbook, label: "Playbook" },
  { to: ROUTES.faq, label: "FAQ" },
] as const;

function isActive(pathname: string, to: string): boolean {
  return normalizePath(pathname) === to;
}

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Site">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.to);
        return (
          <a
            key={link.to}
            href={link.to}
            className={active ? "site-nav-link is-active" : "site-nav-link"}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigate(link.to);
            }}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
