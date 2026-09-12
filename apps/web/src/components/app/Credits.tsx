import { ISSUES_URL, REPO_URL, STEAM_TRADE_URL } from "@/lib/app/links";
import { useMessages } from "@/lib/i18n";
export function Credits() {
  const { messages, tNodes } = useMessages();
  return (
    <footer className="credits">
      <p className="credits-links">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {messages.credits.github}
        </a>
        <span aria-hidden="true">·</span>
        <a href={ISSUES_URL} target="_blank" rel="noreferrer">
          {messages.credits.issues}
        </a>
        <span aria-hidden="true">·</span>
        <a href={STEAM_TRADE_URL} target="_blank" rel="noreferrer">
          {messages.credits.donate}
        </a>
      </p>
      <p>
        {tNodes(messages.credits.attribution, {
          version: __APP_VERSION__,
          radarSource: (
            <a href="https://github.com/MurkyYT/cs2-map-icons" target="_blank" rel="noreferrer">
              cs2-map-icons
            </a>
          ),
          weaponMit: (
            <a
              href="https://github.com/ChetdeJong/cs2-killfeed-generator"
              target="_blank"
              rel="noreferrer"
            >
              cs2-killfeed-generator
            </a>
          ),
          weaponOther: (
            <a
              href="https://github.com/Juknum/counter-strike-icons"
              target="_blank"
              rel="noreferrer"
            >
              counter-strike-icons
            </a>
          ),
        })}
      </p>
    </footer>
  );
}
