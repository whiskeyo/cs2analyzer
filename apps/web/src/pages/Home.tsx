import { DemoDrop } from "@/components/app/DemoDrop";

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

export function Home() {
  return (
    <DemoDrop openAnalyzerOnDrop showSavedNotes={false}>
      <HomeIntro />
    </DemoDrop>
  );
}
