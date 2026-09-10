import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

/** Isolated component tests that call `useNavigate` / `NavLink`. */
export function TestRouter({ children, path = "/" }: { children: ReactNode; path?: string }) {
  return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}
