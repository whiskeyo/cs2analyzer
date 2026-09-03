const REPO_URL = "https://github.com/whiskeyo/cs2analyzer";
const ISSUES_URL = `${REPO_URL}/issues`;
const STEAM_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=69520211&token=YCinud5X";

export function Credits() {
  return (
    <footer className="credits">
      <p className="credits-links">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <a href={ISSUES_URL} target="_blank" rel="noreferrer">
          Issues
        </a>
        <span aria-hidden="true">·</span>
        <a href={STEAM_TRADE_URL} target="_blank" rel="noreferrer">
          Donate
        </a>
      </p>
      <p>
        Made by whiskeyo. Version: {__APP_VERSION__}. Fan project — not affiliated with Valve or
        FACEIT. Radar overviews are Valve's, vendored from{" "}
        <a href="https://github.com/MurkyYT/cs2-map-icons" target="_blank" rel="noreferrer">
          cs2-map-icons
        </a>
        . Weapon icons from{" "}
        <a
          href="https://github.com/ChetdeJong/cs2-killfeed-generator"
          target="_blank"
          rel="noreferrer"
        >
          cs2-killfeed-generator
        </a>{" "}
        (MIT) and{" "}
        <a href="https://github.com/Juknum/counter-strike-icons" target="_blank" rel="noreferrer">
          counter-strike-icons
        </a>
        .
      </p>
    </footer>
  );
}
