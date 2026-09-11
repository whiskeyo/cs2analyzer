import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_CT_SURRENDER,
  WIN_REASON_DEFUSE,
  WIN_REASON_DRAW,
  WIN_REASON_TIME,
  WIN_REASON_T_ELIM,
  WIN_REASON_T_SURRENDER,
} from "@/lib/shared/constants";
import type { FloorMode } from "@/lib/notes/types";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import { t, type Messages } from "./messages";

export function winReasonText(messages: Messages, code: number): string {
  switch (code) {
    case WIN_REASON_BOMB:
      return messages.winReason.bomb;
    case WIN_REASON_DEFUSE:
      return messages.winReason.defuse;
    case WIN_REASON_CT_ELIM:
      return messages.winReason.ctElim;
    case WIN_REASON_T_ELIM:
      return messages.winReason.tElim;
    case WIN_REASON_DRAW:
      return messages.winReason.draw;
    case WIN_REASON_TIME:
      return messages.winReason.time;
    case WIN_REASON_T_SURRENDER:
      return messages.winReason.tSurrender;
    case WIN_REASON_CT_SURRENDER:
      return messages.winReason.ctSurrender;
    default:
      return code ? t(messages.winReason.unknown, { code }) : messages.winReason.none;
  }
}

export function nadeLabel(messages: Messages, kind: GrenadeKind): string {
  switch (kind) {
    case "smoke":
      return messages.nade.smoke;
    case "molotov":
    case "incendiary":
      return messages.nade.molly;
    case "flash":
      return messages.nade.flash;
    case "he":
      return messages.nade.he;
    case "decoy":
      return messages.nade.decoy;
    default:
      return messages.nade.he;
  }
}

export function paletteLabel(messages: Messages, id: string): string {
  switch (id) {
    case "neon":
      return messages.palette.neon;
    case "heat":
      return messages.palette.heat;
    case "night":
      return messages.palette.night;
    case "mark":
      return messages.palette.mark;
    default:
      return messages.palette.neon;
  }
}

export function floorLabel(messages: Messages, mode: FloorMode): string {
  switch (mode) {
    case "upper":
      return messages.preferences.floorUpper;
    case "lower":
      return messages.preferences.floorLower;
    case "auto":
    default:
      return messages.preferences.floorAuto;
  }
}

export function roundKindLabel(messages: Messages, kind: RoundKind): string {
  switch (kind) {
    case "pistol":
      return messages.roundKind.pistol;
    case "eco":
      return messages.roundKind.eco;
    case "force":
      return messages.roundKind.force;
    case "full":
    default:
      return messages.roundKind.full;
  }
}
