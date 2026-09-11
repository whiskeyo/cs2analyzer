import type { Messages } from "../../messages";

export const hud = {
  hud: {
    knife: "Knife",
    roundNumber: "R{number}",
    freeze: "Freeze {seconds}s",
    roundWin: "{winner} wins",
    plant: "Plant {seconds}s",
    c4: "C4 {seconds}s",
    defuse: "Defuse {seconds}s",
    defuseWithKit: "Defuse {seconds}s · kit",
    clutch: "{name} 1v{count}",
  },
  winReason: {
    bomb: "Bomb",
    defuse: "Defuse",
    ctElim: "CT elim",
    tElim: "T elim",
    draw: "Draw",
    time: "Time",
    tSurrender: "T surrender",
    ctSurrender: "CT surrender",
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
    exploded: "Explode",
    defusing: "Defusing",
    planting: "Planting",
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
    pan: "Pan",
    draw: "Draw",
    arrow: "Arrow",
    textNote: "Text note",
    bookmarkTick: "Bookmark this tick (Moment: a few seconds). Nothing is drawn on the radar.",
    erase: "Erase",
    undoDrawing: "Undo drawing (Ctrl+Z)",
    redoDrawing: "Redo drawing (Ctrl+Y)",
    clearRoundDrawings: "Clear drawings on this round",
    resetView: "Reset view",
    snapshotPlaybook: "Snapshot to playbook",
    trackPlayer: "Track player",
    trail: "Trail",
    momentHint: "Moment: new drawings and bookmarks last a few seconds from this tick",
  },
  textNote: {
    dragToMove: "Drag to move",
    placeholder: "Note",
  },
  killfeed: {
    flashAssist: "Flash assist",
    noScope: "No-scope",
    throughSmoke: "Through smoke",
    wallbang: "Wallbang",
    airborne: "Airborne",
    blind: "Blind",
    headshot: "Headshot",
  },
  spectator: {
    cashInventory: "Cash · inventory",
    boughtThisFreeze: "Bought this freeze",
    lastHit: "Last hit: {detail}",
    lastHitArmor: "Last hit: {detail} (armor {armor})",
    knife: "Knife",
  },
  playback: {
    play: "Play",
    pause: "Pause",
    prevRound: "Previous round ([)",
    nextRound: "Next round (])",
    prevKill: "Previous kill (,)",
    nextKill: "Next kill (.)",
    stepBack: "Step back",
    stepForward: "Step forward",
    skipFreeze: "Skip freeze",
    skipFreezeTitle: "Skip freeze (Home)",
    speed: "Speed",
    roundTimeline: "Round timeline",
    knife: "Knife",
    freezeClock: "Freeze {seconds}s",
    autoplayOn: "Round autoplay on — continue to the next round",
    autoplayOff: "Round autoplay off — stop at the end of each round",
    roundStrip: "Round {number}",
    roundHasExecute: "execute",
    roundHasNotes: "notes",
    bucketStepBack: "Step back 1s",
    bucketStepForward: "Step forward 1s",
    bucketTimeline: "Bucket overlay timeline",
    seriesRoundsGroup: "{label} rounds",
    seriesBucketOverlay: "{label} · {side} · all rounds overlay",
    seriesRoundChip: "{label} · {side} #{index}",
  },
  timeline: {
    bombPlanted: "Bomb planted",
    bombDefused: "Bomb defused",
    bombExploded: "Bomb exploded",
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
