import { Link, useLocation } from "react-router";
import { normalizePath, ROUTES } from "@/lib/app/routes";

const LINKS = [
  { to: ROUTES.analyzer, label: "Analyzer" },
  { to: ROUTES.playbook, label: "Playbook" },
  { to: ROUTES.faq, label: "FAQ" },
  { to: ROUTES.rating, label: "Rating" },
  { to: ROUTES.contact, label: "Contact" },
] as const;

export function SiteNav() {
  const { pathname } = useLocation();
  const here = normalizePath(pathname);
  return (
    <nav className="site-nav" aria-label="Site">
      {LINKS.map((link) => {
        const active = here === normalizePath(link.to);
        return (
          <Link
            key={link.to}
            to={link.to}
            className={active ? "site-nav-link is-active" : "site-nav-link"}
            {...(active ? { "aria-current": "page" as const } : {})}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
