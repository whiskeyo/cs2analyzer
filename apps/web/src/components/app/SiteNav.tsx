import { NavLink } from "react-router";
import { ROUTES } from "@/lib/app/routes";
import { useMessages } from "@/lib/i18n/useMessages";

export function SiteNav() {
  const { messages } = useMessages();
  const links = [
    { to: ROUTES.analyzer, label: messages.nav.analyzer },
    { to: ROUTES.playbook, label: messages.nav.playbook },
    { to: ROUTES.faq, label: messages.nav.faq },
  ] as const;

  return (
    <nav className="site-nav" aria-label={messages.nav.site}>
      {links.map((link) => (
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
