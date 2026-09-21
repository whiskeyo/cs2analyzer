import { Link } from "react-router";
import { DemoDrop } from "@/components/app/DemoDrop";
import { CreatePlaybookCard } from "@/components/playbook/CreatePlaybookCard";
import { TutorialStart } from "@/components/tutorial/TutorialStart";
import { ROUTES } from "@/lib/app/routes";
import { FEATURE_LIST_CLASS } from "@/lib/markdown/featureList";

function HomeIntro() {
  return (
    <div className="home-intro">
      <p className="home-kicker">Local-first GOTV analyzer</p>
      <h2>Watch Counter-Strike 2 demos on a 2D radar</h2>
      <p className="home-intro-lead">
        Drop a replay and start reviewing on this machine. Parse, playback, stats, and playbook
        drawings all run in the browser.
      </p>
      <ul className={FEATURE_LIST_CLASS}>
        <li>Live radar, nades, tracking, and drawing.</li>
        <li>FACEIT-style scoreboard, clutches, utility, and round history.</li>
        <li>Habits mode: several demos, same map or mixed maps.</li>
        <li>Kill feed, opening duels, nade summary, and CSV export.</li>
        <li>And way more!</li>
      </ul>
    </div>
  );
}

function HomeDropHint() {
  return (
    <TutorialStart>
      If you have questions, <Link to={ROUTES.faq}>see the FAQ</Link>.{" "}
      <Link to={ROUTES.rating}>Match rating formulas</Link> live on their own page. To reach the
      author, <Link to={ROUTES.contact}>Contact</Link>.
    </TutorialStart>
  );
}

export function Home() {
  return (
    <DemoDrop
      openAnalyzerOnDrop
      showSavedNotes={false}
      beside={<CreatePlaybookCard />}
      below={<HomeDropHint />}
    >
      <HomeIntro />
    </DemoDrop>
  );
}
