import { Link } from "react-router";
import { Credits } from "@/components/app/Credits";
import { FEATURE_LIST_CLASS } from "@/lib/markdown/featureList";
import { warmupTutorialSession } from "@/lib/tutorial/prefetch";
import { tutorialHref } from "@/lib/tutorial/query";

/** Short intro hub. Coach marks start on `/tutorial/single`, not here. */
export function Tutorial() {
  return (
    <div className="home">
      <article className="tutorial">
        <p className="home-kicker">Sample walkthrough</p>
        <h2>Tutorial</h2>
        <p className="tutorial-lead">
          Coach marks highlight one Analyzer control at a time. Explore freely, then click Next in
          the callout to continue.
        </p>
        <ul className={FEATURE_LIST_CLASS}>
          <li>Play and scrub a two-round GOTV sample, then draw on the radar.</li>
          <li>Review, grenade jump, snapshot to the Playbook, and PDF export.</li>
          <li>
            Habits across several demos, then the Playbook. Snapshots land under that session's map.
          </li>
        </ul>
        <Link
          className="tutorial-cta"
          to={tutorialHref("replay")}
          onPointerDown={() => warmupTutorialSession()}
        >
          Start tutorial
        </Link>
      </article>
      <Credits />
    </div>
  );
}
