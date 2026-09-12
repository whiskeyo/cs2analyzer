import type { Messages } from "../../messages";
import { nav } from "./nav";
import { home } from "./home";
import { faq } from "./faq";
import { drop } from "./drop";
import { settings } from "./settings";
import { preferences } from "./preferences";
import { hud } from "./hud";
import { sidebar } from "./sidebar";
import { analyzer } from "./analyzer";
import { playbook } from "./playbook";

export const en = {
  ...nav,
  ...home,
  ...faq,
  ...drop,
  ...settings,
  ...preferences,
  ...hud,
  ...sidebar,
  ...analyzer,
  ...playbook,
} satisfies Messages;
