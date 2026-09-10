import { useState } from "react";
import { Link } from "react-router";
import { DemoDrop } from "@/components/app/DemoDrop";
import { CreatePlaybookDialog } from "@/components/playbook/CreatePlaybookDialog";
import { PlaybookMark } from "@/components/playbook/PlaybookMark";
import { ROUTES } from "@/lib/app/routes";

function HomeIntro() {
  return (
    <div className="home-intro">
      <p className="home-kicker">Local-first GOTV viewer</p>
      <h2>Watch Counter-Strike 2 demos on a 2D radar</h2>
      <p className="home-intro-lead">
        Drop a replay and start reviewing on this machine. Parse, playback, stats, and drawings all
        run in the browser.
      </p>
      <ul className="feature-list">
        <li>Live radar, nades, tracking, and drawing.</li>
        <li>FACEIT-style scoreboard, clutches, utility, and round history.</li>
        <li>Habits mode: several demos, same map or mixed maps.</li>
        <li>Kill feed, opening duels, nade summary, and CSV export.</li>
        <li>And way more!</li>
      </ul>
    </div>
  );
}

function HomePlaybookCta() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="home-card home-playbook" onClick={() => setOpen(true)}>
        <PlaybookMark />
        <div className="drop-title">Create a playbook</div>
        <p className="drop-blurb">Draw named strats on a radar. No demo required.</p>
        <p className="muted">Open playbook. Nothing is uploaded.</p>
      </button>
      {open ? <CreatePlaybookDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HomeFaqHint() {
  return (
    <p className="home-faq-hint muted">
      If you have questions, <Link to={ROUTES.faq}>see the FAQ</Link>.
    </p>
  );
}

export function Home() {
  return (
    <DemoDrop
      openAnalyzerOnDrop
      showSavedNotes={false}
      beside={<HomePlaybookCta />}
      below={<HomeFaqHint />}
    >
      <HomeIntro />
    </DemoDrop>
  );
}
