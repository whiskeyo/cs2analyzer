/* tslint:disable */
/* eslint-disable */

/**
 * Parsed match handle. Tick buffers are exposed as typed arrays.
 *
 * `Match::stats` is deliberately not exposed: it is a whole-match snapshot,
 * while the viewer needs the scoreboard through the current tick and computes
 * that itself in `apps/web/src/lib/stats/stats.ts`. Use the CLI for a
 * match-level Rust tally.
 */
export class ParsedMatch {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    active(): Uint8Array;
    armor(): Uint8Array;
    blindsJson(): string;
    bombEventsJson(): string;
    buyEventsJson(): string;
    clip(): Uint8Array;
    controllerDumpJson(): string;
    equip(): Uint16Array;
    flags(): Uint8Array;
    frameCount(): number;
    gear(): Uint16Array;
    grenadesJson(): string;
    headerJson(): string;
    health(): Uint8Array;
    hurtsJson(): string;
    killsJson(): string;
    money(): Uint16Array;
    playerCount(): number;
    playersJson(): string;
    primary(): Uint8Array;
    reserve(): Uint16Array;
    roundsJson(): string;
    secondary(): Uint8Array;
    shotsJson(): string;
    ticks(): Uint32Array;
    x(): Float32Array;
    y(): Float32Array;
    yaw(): Float32Array;
    z(): Float32Array;
}

/**
 * Parse a CS2 demo. `progress` is called as `progress(currentTick, totalTicks)`.
 */
export function parseDemo(data: Uint8Array, tick_stride: number, skip_warmup: boolean, progress?: Function | null): ParsedMatch;

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_parsedmatch_free: (a: number, b: number) => void;
    readonly parseDemo: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly parsedmatch_active: (a: number) => number;
    readonly parsedmatch_armor: (a: number) => number;
    readonly parsedmatch_blindsJson: (a: number, b: number) => void;
    readonly parsedmatch_bombEventsJson: (a: number, b: number) => void;
    readonly parsedmatch_buyEventsJson: (a: number, b: number) => void;
    readonly parsedmatch_clip: (a: number) => number;
    readonly parsedmatch_controllerDumpJson: (a: number, b: number) => void;
    readonly parsedmatch_equip: (a: number) => number;
    readonly parsedmatch_flags: (a: number) => number;
    readonly parsedmatch_frameCount: (a: number) => number;
    readonly parsedmatch_gear: (a: number) => number;
    readonly parsedmatch_grenadesJson: (a: number, b: number) => void;
    readonly parsedmatch_headerJson: (a: number, b: number) => void;
    readonly parsedmatch_health: (a: number) => number;
    readonly parsedmatch_hurtsJson: (a: number, b: number) => void;
    readonly parsedmatch_killsJson: (a: number, b: number) => void;
    readonly parsedmatch_money: (a: number) => number;
    readonly parsedmatch_playerCount: (a: number) => number;
    readonly parsedmatch_playersJson: (a: number, b: number) => void;
    readonly parsedmatch_primary: (a: number) => number;
    readonly parsedmatch_reserve: (a: number) => number;
    readonly parsedmatch_roundsJson: (a: number, b: number) => void;
    readonly parsedmatch_secondary: (a: number) => number;
    readonly parsedmatch_shotsJson: (a: number, b: number) => void;
    readonly parsedmatch_ticks: (a: number) => number;
    readonly parsedmatch_x: (a: number) => number;
    readonly parsedmatch_y: (a: number) => number;
    readonly parsedmatch_yaw: (a: number) => number;
    readonly parsedmatch_z: (a: number) => number;
    readonly start: () => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
