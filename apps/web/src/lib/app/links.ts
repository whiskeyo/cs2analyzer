export const REPO_URL = "https://github.com/whiskeyo/cs2analyzer";
export const ISSUES_URL = `${REPO_URL}/issues`;
export const STEAM_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=69520211&token=YCinud5X";
export const CONTACT_EMAIL = "duchowe50k@gmail.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
export const STEAM_PROFILE_URL = "https://steamcommunity.com/id/whiskeyo/";
export const STEAM_GROUP_URL = "https://steamcommunity.com/groups/cs2analyzer-whiskeyo";

export const CONTACT_CHANNELS = [
  {
    href: CONTACT_MAILTO,
    label: "Email",
    detail: CONTACT_EMAIL,
    external: false,
  },
  {
    href: STEAM_PROFILE_URL,
    label: "Steam profile",
    detail: "steamcommunity.com/id/whiskeyo",
    external: true,
  },
  {
    href: STEAM_GROUP_URL,
    label: "Steam group",
    detail: "steamcommunity.com/groups/cs2analyzer-whiskeyo",
    external: true,
  },
  {
    href: REPO_URL,
    label: "GitHub",
    detail: "github.com/whiskeyo/cs2analyzer",
    external: true,
  },
] as const;
