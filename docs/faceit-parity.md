# FACEIT parity and analysis roadmap

Compared against FACEIT match `1-a333d902-16d8-41ab-9ce8-cdc5445f3508` (Anubis OT, SHAFRA0 16 – mont3rax 14) using the GOTV demo in `.demos/` (not committed). FACEIT HTML is Cloudflare-blocked from this environment; numbers below are from FACEIT’s official analysis UI (scoreboard / KAST / entry / clutch) plus our CLI parse.

## What already matches

| | FACEIT | Ours |
|---|---|---|
| Map / score | Anubis 16–14 SHAFRA0 | `de_anubis` CT 16 (SHAFRA0) – T 14 (mont3rax) |
| Rounds | 30 (+ knife) | 31 rows, 30 competitive |
| Opening (FK/FD) | Entry kills/deaths | Same for all 10 players (e.g. hejku1 5/9, Adasko 6/5, whiskeyo 2/1) |
| KAST | CurseBEAR 63.3, yami 80.0, mont3rax 70.0 | Exact |
| ADR | whiskeyo 106.6, grk4BR 58.7, … | 106.9 / 58.8 (≤ 1.3 everywhere) |

ADR remaining delta is rounding / HP-cap vs FACEIT’s live analyzer, not a second formula bug. FACEIT **Rating** is their own (with Swing); we show HLTV 2.0-style. Those will not match — that is FACEIT, not us being “wrong.”

## Remaining scoreboard gaps

| Player | FACEIT K/D/A | Ours | FACEIT KAST | Ours |
|---|---|---|---|---|
| whiskeyo | 30/21/7 | 31/22/7 | 80.0 | 83.3 |
| SHAFRA0 | 23/17/3 | 23/17/4 | | 70.0 |
| mont3rax | 21/21/3 | 21/21/4 | 70.0 | 70.0 |
| grk4BR | 15/25/6 | 15/25/7 | 53.3 | 56.7 |
| others | exact K/D/A | exact | | |

One extra kill **and** death, only on whiskeyo, plus +1 assist on three players. That pattern is a **suicide counted as a kill** (and KAST from it) plus **same-side / flash assists** FACEIT omits from A. FACEIT is the reference for K/D/A here; we should drop suicides from K and D and only credit enemy frags/assists.

## Improvements (priority)

1. **Enemy-only K/D/A** — skip suicide and teamkills as kills; skip suicide as death; assists only vs enemies. (Accuracy)
2. **Entry attempts / success %** — FACEIT entry tab: attempt = opening duel (FK or FD). We already have FK/FD; surface attempts and success, and team share.
3. **CT vs T splits** — ADR, K/D, opening on each side. Gamestyle (lurker vs entry) shows up here.
4. **Positive highlights** — Review is “what went wrong.” Add clutch wins, eco round wins, 4k/ace, traded openers as jump-to events.
5. **Later (not this pass)** — multi-demo drop for patterns; RWS / FACEIT Swing (proprietary); MVP from demo (unreliable); aim error from yaw-only (no pitch, GOTV ≠ server).

Tests must use tiny synthetic matches, never `.demos/*.dem`.
