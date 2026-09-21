/**
 * Optional starter books for `/tutorial/playbook`. Empty until you add your own.
 *
 * Existing export path (do not invent another):
 * 1. Author strats in the real Playbook (`/playbook`).
 * 2. Settings → Export playbooks. That writes `cs2analyzer-playbooks.json`
 *    (`serializePlaybookBundle` / `PLAYBOOK_EXPORT_FILE` in
 *    `apps/web/src/lib/playbook/transfer.ts`).
 * 3. Drop that JSON here as `sample.json` and parse it:
 *
 *    import raw from "./sample.json";
 *    import { parsePlaybookBundle } from "@/lib/playbook/transfer";
 *    export const tutorialPlaybooks = parsePlaybookBundle(raw)?.playbooks ?? [];
 *
 * One book per map. Prefer key `tutorial-playbook:<map>` (see
 * `tutorialPlaybookKey`) so the snapshot picker treats it as Tutorial.
 * Snapshots from Single / Aggregated still append to the live book for
 * that session map; they do not retag onto another map.
 */

import type { Playbook } from "@/lib/playbook/types";

export const tutorialPlaybooks: Playbook[] = [];
