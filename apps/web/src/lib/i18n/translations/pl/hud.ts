import type { Messages } from "../../messages";

export const hud = {
  hud: {
    knife: "Knife",
    roundNumber: "R{number}",
    freeze: "Freeze {seconds}s",
    roundWin: "Wygrana {winner}",
    plant: "Plant {seconds}s",
    c4: "C4 {seconds}s",
    defuse: "Defuse {seconds}s",
    defuseWithKit: "Defuse {seconds}s · kit",
    clutch: "{name} 1v{count}",
  },
  winReason: {
    bomb: "Bomba",
    defuse: "Defuse",
    ctElim: "Elim. CT",
    tElim: "Elim. T",
    draw: "Remis",
    time: "Czas",
    tSurrender: "Poddanie T",
    ctSurrender: "Poddanie CT",
    unknown: "#{code}",
    none: "—",
  },
  nade: {
    smoke: "Smoke",
    molly: "Molly",
    flash: "Flash",
    he: "HE",
    decoy: "Decoy",
    incendiary: "Incendiary",
  },
  bombEvent: {
    planted: "Plant",
    defused: "Defuse",
    exploded: "Wybuch",
    defusing: "Defuse",
    planting: "Plantowanie",
  },
  palette: {
    neon: "Neon",
    heat: "Heat",
    night: "Night",
    mark: "Mark",
    cycleTitle: "{name} ([ ])",
    swatchTitle: "{color} ({hotkey})",
  },
  toolbar: {
    pan: "Przesuwanie",
    draw: "Rysowanie",
    arrow: "Strzałka",
    textNote: "Notatka tekstowa",
    bookmarkTick: "Zakładka na tym ticku (Moment: kilka sekund). Nic nie rysuje się na radarze.",
    erase: "Gumka",
    undoDrawing: "Cofnij rysunek (Ctrl+Z)",
    redoDrawing: "Ponów rysunek (Ctrl+Y)",
    clearRoundDrawings: "Wyczyść rysunki z tej rundy",
    resetView: "Reset widoku",
    snapshotPlaybook: "Snapshot do playbooka",
    trackPlayer: "Śledź gracza",
    trail: "Ślad",
    momentHint: "Moment: nowe rysunki i zakładki trwają kilka sekund od tego ticka",
  },
  textNote: {
    dragToMove: "Przeciągnij, żeby przesunąć",
    placeholder: "Notatka",
  },
  killfeed: {
    flashAssist: "Asysta flasha",
    noScope: "No-scope",
    throughSmoke: "Przez smoka",
    wallbang: "Wallbang",
    airborne: "W powietrzu",
    blind: "Oślepiony",
    headshot: "Headshot",
  },
  spectator: {
    cashInventory: "Kasa · ekwipunek",
    boughtThisFreeze: "Kupione w tym freeze",
    lastHit: "Ostatnie trafienie: {detail}",
    lastHitArmor: "Ostatnie trafienie: {detail} (armor {armor})",
    knife: "Knife",
  },
  playback: {
    play: "Odtwarzaj",
    pause: "Pauza",
    prevRound: "Poprzednia runda ([)",
    nextRound: "Następna runda (])",
    prevKill: "Poprzedni frag (,)",
    nextKill: "Następny frag (.)",
    stepBack: "Krok wstecz",
    stepForward: "Krok naprzód",
    skipFreeze: "Pomiń freeze",
    skipFreezeTitle: "Pomiń freeze (Home)",
    speed: "Prędkość",
    roundTimeline: "Oś rundy",
    knife: "Knife",
    freezeClock: "Freeze {seconds}s",
    autoplayOn: "Autoodtwarzanie rund włączone — przejdź do następnej rundy",
    autoplayOff: "Autoodtwarzanie rund wyłączone — stop na końcu każdej rundy",
    roundStrip: "Runda {number}",
    roundHasExecute: "execute",
    roundHasNotes: "notatki",
    bucketStepBack: "Cofnij 1s",
    bucketStepForward: "Do przodu 1s",
    bucketTimeline: "Oś overlay bucketu",
    seriesRoundsGroup: "Rundy {label}",
    seriesBucketOverlay: "{label} · {side} · overlay wszystkich rund",
    seriesRoundChip: "{label} · {side} #{index}",
  },
  timeline: {
    bombPlanted: "Bomba podłożona",
    bombDefused: "Bomba rozbrojona",
    bombExploded: "Bomba wybuchła",
  },
  roundKind: {
    pistol: "Pistol",
    eco: "Eco",
    force: "Force",
    full: "Full",
  },
} satisfies Pick<
  Messages,
  | "hud"
  | "winReason"
  | "nade"
  | "bombEvent"
  | "palette"
  | "toolbar"
  | "textNote"
  | "killfeed"
  | "spectator"
  | "playback"
  | "timeline"
  | "roundKind"
>;
