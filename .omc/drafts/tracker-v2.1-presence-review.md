# Tracker v2.1 presence — consensus review r1 (2026-09-30)

Snapshot: `.omc/drafts/tracker-v2.1-presence-r1-snapshot.md`. The fable-critic and Codex ran in parallel on the same snapshot. Neither was given the other's output. The verdicts below are the orchestrator's.

## fable-critic — APPROVE WITH CHANGES
- **C1** BLOCKER: the `cell` payload has no sender key. CONFIRMED: a broadcast carries only the payload (same as Codex X1). Fix: add `key` to the payload.
- **C2** MAJOR: the shared topic plus the async `removeChannel` causes a remount hazard. CONFIRMED against the existing comments at `useTaskRealtime.ts:51` and `useRealtimeRefresh.ts:61` (same as X2). Fix: a serialized lifecycle.
- **C3** MAJOR: `selectedId` is never cleared, so "editing" would stick. CONFIRMED: `GanttBoard.tsx:79` sets it, and only L256 clears it (on delete). Fix: count a task as editing only while it is dragged or the panel has unsaved changes.
- **C4** MAJOR: the gate counts own tabs. CONFIRMED against the owner's intent ("only 1 person → off"). Fix: gate on another email, plus a test-only override.
- **C5** MAJOR: deploy ordering for private channels. SUPERSEDED: only the presence channel is private now. A deploy without the migration just means no presence. The order is documented anyway.
- **C6** MINOR: month in the cell payload. CONFIRMED.
- **C7** MINOR: bind presence listeners before subscribe. CONFIRMED (`RealtimeChannel.js:143-145`).
- **C8** MINOR: refs vs state, and hover on inactive rows. CONFIRMED. Hover is sent on all rows.
- **C9** MINOR: acceptance methods and numbering. CONFIRMED.
- **C10** MINOR: 20 s expiry drops a resting tag. CONFIRMED. The expiry is removed; membership reconciles on sync.
- The critic said private channels are "only enforced once public access is off". This reading of the docs is REJECTED in favour of Codex X8 (see below).

## Codex — AGREE WITH CHANGES
- **X1** MAJOR: broadcasts can't be attributed to a tab. CONFIRMED (= C1).
- **X2** MAJOR: month navigation remounts, and a same-topic channel can be reused while leaving. CONFIRMED: the `[projectId]/page.tsx:58` key includes the month (= C2).
- **X3** MAJOR: the gate must be re-checked at send time, and a disconnected send falls back to HTTP. CONFIRMED (`RealtimeChannel.ts:1062`). Fix: re-check before every send, and send only while the channel is `joined`.
- **X4** MAJOR: the budget omits fan-out. CONFIRMED: the math is right. A traffic budget and A3b were added.
- **X5** MINOR: a `leave` fires on metadata replacement. CONFIRMED (`phoenix/presence.js:161`). Fix: rebuild membership from sync.
- **X6** MAJOR (hypothesis): a token rotated during an in-flight join. PLAUSIBLE and low-probability. Covered by recreating the channel on error with backoff, plus A8.
- **X7** MINOR: pointer capture during drags. CONFIRMED (`useBarDrag.ts:41`, `useDragCreate.ts:30`). Fix: suspend live cells while pointer capture is active.
- **X8** MINOR: public and private rooms with the same topic are separate. CONFIRMED by the Supabase docs (https://supabase.com/docs/guides/realtime/concepts). This cut scope: only the presence channel goes private, and there is no dashboard flip.
