import { Link } from "react-router";
import { Credits } from "@/components/app/Credits";
import { ISSUES_URL } from "@/lib/app/links";
import { ROUTES } from "@/lib/app/routes";

export function NotFound() {
  return (
    <div className="home">
      <article className="not-found">
        <h2>This page does not exist. Are you sure the link is correct?</h2>
        <p className="not-found-lead">
          If you think that the link is correct, please report the issue by clicking{" "}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            here
          </a>
          .
        </p>
        <p className="not-found-home">
          <Link to={ROUTES.home}>Go back to CS2 Analyzer</Link>
        </p>
      </article>
      <Credits />
    </div>
  );
}
