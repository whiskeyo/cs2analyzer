/** Shared 16×16 stroke paths for Analyzer, Playbook, and Layouts toolbars. */
export const TOOLBAR_PATHS = {
  pan: "M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5 10 3.5M8 14.5 6 12.5M8 14.5 10 12.5M1.5 8 3.5 6M1.5 8 3.5 10M14.5 8 12.5 6M14.5 8 12.5 10",
  pen: "M11 2.5 13.5 5 6 12.5H3.5V10Z M8.5 5 11 7.5",
  arrow: "M3 13 13 3M8 3h5v5",
  text: "M3.5 3.5h9M8 3.5V13M5 13h6",
  erase: "M4.5 11.5 10 6l2.5 2.5-5.5 5.5H4.5v-2.5Z M6.5 13.5h6",
  undo: "M5 5 2 8l3 3M2 8h7.5a3.5 3.5 0 1 1 0 7",
  redo: "M11 5 14 8l-3 3M14 8H6.5a3.5 3.5 0 1 0 0 7",
  clear: "M5 5.5h6M6 5.5V4h4v1.5M6 5.5 7 13h2l.5-7.5",
  reset: "M3 8a5 5 0 1 0 1.5-3.5M3 3v3h3",
  snapshot: "M2.5 5.5h2l1-1.5h5l1 1.5h2v8h-11Z M8 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  track: "M8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 3.5V2M8 14v-1.5M3.5 8H2M14 8h-1.5",
  trail: "M3 12c2-1 3-4 5-4s3 3 5 2",
  moment: "M8 3.5A4.5 4.5 0 1 1 3.5 8M8 5.5V8l1.8 1.2",
  bookmark: "M4.5 2h7v12l-3.5-2.2L4.5 14Z",
  polygon: "M2.5 11 5 3.5h6.5L14 9.5 8.5 14Z",
  rect: "M3.5 3.5h9v9h-9Z",
  circle: "M13 8A5 5 0 1 1 3 8a5 5 0 0 1 10 0Z",
  select: "M4 2.5v11l3.2-3.2 2.2 5.2 1.6-.7-2.2-5.2H13Z",
  nadeTrail: "M2 13c3-1 4-7 6-7s2 4 6 1M8 6.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4",
  nadeIcon: "M4 3.5h8v9H4Z M8 3.5v9",
  nadeEffect: "M8 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
} as const;

export type ToolbarPathId = keyof typeof TOOLBAR_PATHS;
