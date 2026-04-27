# Operator Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `rindaman_check` and `rindaman_status` feel like an operator console by adding freshness and next-action guidance.

**Architecture:** Keep the existing plugin tools and session state, but add small freshness and next-action evaluators. Surface the results through `rindaman_status` and the human-readable output from `rindaman_check`.

**Tech Stack:** TypeScript OpenCode plugin, modular plugin helpers, `node:test` plugin integration tests.

---

## File Structure

- Modify: `src/plugin/session-state.ts`
- Modify: `src/plugin/final-response-gate.ts` or add a sibling helper module if needed
- Modify: `src/plugin/tools.ts`
- Modify: `test/plugin.test.mjs`
- Modify: `README.md`

## Task 1: Add Freshness Semantics

**Files:**
- Modify: `src/plugin/session-state.ts`
- Modify: `src/plugin/tools.ts`

- [ ] **Step 1: Extend session state**

In `src/plugin/session-state.ts`, add:

```ts
export type CheckFreshness = "not_run" | "fresh" | "stale"
```

Add to `SessionQualityState`:

```ts
  dirtySinceCheck?: boolean
```

- [ ] **Step 2: Track freshness invalidation**

When a successful or failed check runs in `createRindamanCheckTool`, set:

```ts
      sessionState.dirtySinceCheck = false
```

When file or terminal tool activity happens in `tool.execute.after`, if it affects the session:

```ts
        sessionState.dirtySinceCheck = true
```

- [ ] **Step 3: Add freshness helper**

Add to `src/plugin/tools.ts`:

```ts
const getCheckFreshness = (sessionState: SessionQualityState): CheckFreshness => {
  if (!sessionState.lastCheckStatus) {
    return "not_run"
  }

  return sessionState.dirtySinceCheck ? "stale" : "fresh"
}
```

- [ ] **Step 4: Add status field**

In `createRindamanStatusTool`, include:

```ts
          checkFreshness,
```

after computing:

```ts
      const checkFreshness = getCheckFreshness(sessionState)
```

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: existing tests pass or reveal expected assertion updates.

## Task 2: Add Next Action Guidance

**Files:**
- Modify: `src/plugin/tools.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add next-action type**

In `src/plugin/tools.ts`, add:

```ts
type NextAction = {
  command: string | null
  reason: string
}
```

- [ ] **Step 2: Add next-action resolver**

Add:

```ts
const getNextAction = (
  verificationRequired: boolean,
  checkFreshness: CheckFreshness,
  finalResponse: FinalResponseGate,
): NextAction => {
  if (verificationRequired && checkFreshness === "not_run") {
    return {
      command: "rindaman_check",
      reason: "verification has not been run for this session",
    }
  }

  if (verificationRequired && checkFreshness === "stale") {
    return {
      command: "rindaman_check",
      reason: "files changed after the last verification",
    }
  }

  if (!finalResponse.allowed) {
    return {
      command: "rindaman_check",
      reason: finalResponse.reason,
    }
  }

  return {
    command: null,
    reason: "no action required",
  }
}
```

- [ ] **Step 3: Include nextAction in status**

In `createRindamanStatusTool`, compute:

```ts
      const nextAction = getNextAction(
        verificationRequired,
        checkFreshness,
        finalResponse,
      )
```

Then include:

```ts
          nextAction,
```

- [ ] **Step 4: Extend check output**

In `createRindamanCheckTool`, after final-response lines, append:

```ts
        "Next action: " + (nextAction.command ?? "none"),
        "Next action reason: " + nextAction.reason,
```

after computing a `nextAction` from the latest session state.

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: existing tests pass or expose required status assertions.

## Task 3: Add Operator Tests

**Files:**
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add untouched-session freshness test**

```js
test("untouched session reports not_run freshness", async () => {
  const hooks = await server()
  const context = createToolContext()
  const status = await readStatus(hooks, context)

  assert.equal(status.checkFreshness, "not_run")
  assert.equal(status.nextAction.command, null)
})
```

- [ ] **Step 2: Add passing-check freshness test**

```js
test("passing check reports fresh status", async () => {
  const hooks = await server()
  const context = createToolContext()

  await hooks.tool.rindaman_check.execute(
    { mode: "doctor", json: true, strict: false, report: false },
    context,
  )
  const status = await readStatus(hooks, context)

  assert.equal(status.checkFreshness, "fresh")
})
```

- [ ] **Step 3: Add stale-after-edit test**

```js
test("edit after check reports stale status and next action", async () => {
  const hooks = await server()
  const context = createToolContext()

  await hooks.tool.rindaman_check.execute(
    { mode: "doctor", json: true, strict: false, report: false },
    context,
  )
  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  )

  const status = await readStatus(hooks, context)

  assert.equal(status.checkFreshness, "stale")
  assert.equal(status.nextAction.command, "rindaman_check")
})
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: operator semantics tests pass.

## Task 4: Documentation Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add status fields**

Extend the `rindaman_status` section with:

```md
- `checkFreshness`
- `nextAction.command`
- `nextAction.reason`
```

- [ ] **Step 2: Add operator note**

Add a short note:

```md
`rindaman_status` is intended to answer both “what state is the session in?” and “what should I do next?”
```

- [ ] **Step 3: Run full tests**

Run: `npm test`

Expected: all tests pass.

## Task 5: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run doctor JSON**

Run: `node bin/rindaman.cjs doctor --json`

Expected: JSON output with `status` equal to `passed`.

- [ ] **Step 4: Run package dry-run**

Run: `npm pack --dry-run`

Expected: package dry-run succeeds.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intended operator-interface files are modified.
