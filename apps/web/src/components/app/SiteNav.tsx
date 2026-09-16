import { NavLink } from "react-router";
import { ROUTES } from "@/lib/app/routes";

const LINKS = [
  { to: ROUTES.analyzer, label: "Analyzer" },
  { to: ROUTES.playbook, label: "Playbook" },
  { to: ROUTES.faq, label: "FAQ" },
  { to: ROUTES.rating, label: "Rating" },
  { to: ROUTES.contact, label: "Contact" },
] as const;

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Site">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? "site-nav-link is-active" : "site-nav-link")}
          end
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
